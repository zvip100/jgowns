import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectRecord = {
  run: () => void | (() => void);
  dependencies: readonly unknown[] | undefined;
};

const { hookState, mockCaptureEvent } = vi.hoisted(() => ({
  hookState: {
    effects: [] as EffectRecord[],
    refCallCount: 0,
    refs: [] as { current: unknown }[],
    stateCallCount: 0,
    stateValues: new Map<number, unknown>(),
  },
  mockCaptureEvent: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useEffect: (
      run: () => void | (() => void),
      dependencies?: readonly unknown[],
    ): void => {
      hookState.effects.push({ run, dependencies });
    },
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refCallCount++;
      if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
      return hookState.refs[index] as { current: Value };
    },
    useState: <State>(
      initial: State | (() => State),
    ): [State, (next: unknown) => void] => {
      const index = hookState.stateCallCount++;
      const initialValue =
        typeof initial === "function" ? (initial as () => State)() : initial;
      const value = hookState.stateValues.has(index)
        ? hookState.stateValues.get(index)
        : initialValue;
      return [value as State, () => {}];
    },
  };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), null],
}));
vi.mock("@/lib/analytics/client", () => ({ captureEvent: mockCaptureEvent }));
vi.mock("@/components/lightbox/Lightbox", () => ({ Lightbox: () => null }));
vi.mock("next/image", () => ({ default: () => null }));

import { ImageViewer } from "@/app/(main)/browse/[id]/ImageViewer";

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const PHOTOS = ["a.webp", "b.webp", "c.webp"];

type ImageViewerHandles = {
  unmount: () => void;
  heroSeen: Set<number>;
  lightboxSeen: Set<number>;
  lightboxStart: { current: unknown };
  lightboxPending: { current: unknown };
};

function mount(imageUrls: string[] = PHOTOS): ImageViewerHandles {
  hookState.effects = [];
  hookState.refCallCount = 0;
  hookState.refs = [];
  hookState.stateCallCount = 0;
  hookState.stateValues = new Map();

  ImageViewer({
    listingId: LISTING_ID,
    imageUrls,
    blurDataUrls: [],
    title: "Gown",
  });

  const cleanups = hookState.effects.map((effect) => effect.run());

  return {
    unmount: () => {
      for (const cleanup of cleanups) {
        if (typeof cleanup === "function") cleanup();
      }
    },
    heroSeen: hookState.refs[1].current as Set<number>,
    lightboxSeen: hookState.refs[2].current as Set<number>,
    lightboxStart: hookState.refs[3],
    lightboxPending: hookState.refs[4],
  };
}

beforeEach(() => {
  mockCaptureEvent.mockReset();
  // The flush effect registers a pagehide listener; the walk needs a window.
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    visibilityState: "hidden",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("listing_photos_browsed", () => {
  it("reports the unique photos seen when the buyer leaves the page", () => {
    const viewer = mount();
    viewer.heroSeen.add(1);
    viewer.heroSeen.add(2);
    viewer.heroSeen.add(1);

    viewer.unmount();

    expect(mockCaptureEvent).toHaveBeenCalledWith("listing_photos_browsed", {
      listing_id: LISTING_ID,
      photos_viewed: 3,
      photos_total: 3,
    });
  });

  // One photo seen is not browsing; that visit is already `listing_viewed`.
  it("stays silent when only the first photo was seen", () => {
    mount().unmount();
    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });

  it("stays silent for a single-photo listing", () => {
    mount(["only.webp"]).unmount();
    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});

describe("lightbox_opened", () => {
  function openLightbox(viewer: ImageViewerHandles, startIndex: number): void {
    viewer.lightboxStart.current = startIndex;
    viewer.lightboxPending.current = true;
  }

  it("fires on unmount when the buyer leaves with the viewer open", () => {
    const viewer = mount();
    openLightbox(viewer, 1);
    viewer.lightboxSeen.add(1);
    viewer.lightboxSeen.add(2);

    viewer.unmount();

    expect(mockCaptureEvent).toHaveBeenCalledWith("lightbox_opened", {
      listing_id: LISTING_ID,
      start_index: 1,
      photos_seen: 2,
      photos_total: 3,
    });
  });

  it("does not fire when the lightbox was never opened", () => {
    const viewer = mount();
    viewer.unmount();

    const names = mockCaptureEvent.mock.calls.map((call) => call[0]);
    expect(names).not.toContain("lightbox_opened");
  });

  it("fires once per open, never twice for the same session", () => {
    const viewer = mount();
    openLightbox(viewer, 0);
    viewer.lightboxSeen.add(0);

    // The pending flag is what a close consumes; unmount must not re-fire it.
    viewer.lightboxPending.current = false;
    viewer.unmount();

    const names = mockCaptureEvent.mock.calls.map((call) => call[0]);
    expect(names.filter((name) => name === "lightbox_opened")).toHaveLength(0);
  });
});

/**
 * A hard navigation or a closed tab destroys the document without ever
 * unmounting React, so `pagehide` is the only chance these events get.
 */
describe("flush on page teardown", () => {
  function pagehideHandler(): () => void {
    const addEventListener = (window as unknown as {
      addEventListener: { mock: { calls: [string, () => void][] } };
    }).addEventListener;
    const entry = addEventListener.mock.calls.find(([name]) => name === "pagehide");
    if (!entry) throw new Error("no pagehide listener was registered");
    return entry[1];
  }

  it("captures browsed photos when the page is torn down, not unmounted", () => {
    const viewer = mount();
    viewer.heroSeen.add(1);

    pagehideHandler()();

    expect(mockCaptureEvent).toHaveBeenCalledWith("listing_photos_browsed", {
      listing_id: LISTING_ID,
      photos_viewed: 2,
      photos_total: 3,
    });
  });

  it("captures an open lightbox on teardown", () => {
    const viewer = mount();
    viewer.lightboxStart.current = 2;
    viewer.lightboxPending.current = true;
    viewer.lightboxSeen.add(2);

    pagehideHandler()();

    expect(mockCaptureEvent).toHaveBeenCalledWith("lightbox_opened", {
      listing_id: LISTING_ID,
      start_index: 2,
      photos_seen: 1,
      photos_total: 3,
    });
  });

  // Teardown then unmount must not double count the same visit.
  it("never captures the same visit twice", () => {
    const viewer = mount();
    viewer.heroSeen.add(1);
    viewer.lightboxPending.current = true;

    pagehideHandler()();
    viewer.unmount();

    const names = mockCaptureEvent.mock.calls.map((call) => call[0]);
    expect(names.filter((n) => n === "listing_photos_browsed")).toHaveLength(1);
    expect(names.filter((n) => n === "lightbox_opened")).toHaveLength(1);
  });
});
