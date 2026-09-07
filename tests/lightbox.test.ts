import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The viewer on the repo's own react-hook mock harness (no jsdom or
 * testing-library in this project). A "click" is calling the rendered node's
 * onClick and re-rendering, which is enough to exercise every piece of state
 * the arrows, the zoom controls, and the counter read.
 */
type RenderedNode = { type: unknown; props: Record<string, unknown> };

const { hookState, emblaApi } = vi.hoisted(() => ({
  hookState: {
    states: [] as unknown[],
    refs: [] as { current: unknown }[],
    callbacks: [] as { value: unknown; deps: readonly unknown[] }[],
    stateIndex: 0,
    refIndex: 0,
    callbackIndex: 0,
  },
  emblaApi: {
    on: () => {},
    off: () => {},
    scrollTo: (() => {}) as (index: number) => void,
    selectedScrollSnap: () => 0,
  },
}));

function areDepsEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (!previous || !next) return false;
  if (previous.length !== next.length) return false;
  return previous.every((value, index) => Object.is(value, next[index]));
}

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(
      callback: Callback,
      deps: readonly unknown[],
    ): Callback => {
      const index = hookState.callbackIndex++;
      const previous = hookState.callbacks[index];
      if (previous && areDepsEqual(previous.deps, deps)) {
        return previous.value as Callback;
      }
      hookState.callbacks[index] = { value: callback, deps };
      return callback;
    },
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refIndex++;
      if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
      return hookState.refs[index] as { current: Value };
    },
    useState: <State>(
      initial: State,
    ): [State, (next: State | ((current: State) => State)) => void] => {
      const index = hookState.stateIndex++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      const setState = (next: State | ((current: State) => State)): void => {
        hookState.states[index] =
          typeof next === "function"
            ? (next as (current: State) => State)(
                hookState.states[index] as State,
              )
            : next;
      };
      return [hookState.states[index] as State, setState];
    },
    useEffect: (): void => {},
  };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [() => {}, emblaApi],
}));

// Radix would run React APIs at import time under the mock above, and none of
// the shell's own behavior is what these tests are about.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: "Dialog",
  DialogClose: "DialogClose",
  DialogContent: "DialogContent",
  DialogTitle: "DialogTitle",
}));

import { Lightbox, MAX_ZOOM, clampZoom } from "@/components/lightbox/Lightbox";

const URLS = ["https://x.test/1.webp", "https://x.test/2.webp", "https://x.test/3.webp"];
const BLURS = ["b1", "b2", "b3"];

function collect(node: unknown, out: RenderedNode[] = []): RenderedNode[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const candidate = node as { type?: unknown; props?: Record<string, unknown> };
  if (!("type" in candidate)) return out;
  const props = candidate.props ?? {};
  // The footer is a pure presentational leaf, so walking through it keeps its
  // buttons visible to these assertions.
  if (typeof candidate.type === "function" && candidate.type.name === "LightboxToolbar") {
    collect((candidate.type as (p: Record<string, unknown>) => unknown)(props), out);
    return out;
  }
  out.push({ type: candidate.type, props });
  collect(props.children, out);
  collect(props.left, out);
  collect(props.right, out);
  return out;
}

let element: unknown = null;

/** A fresh mount: state starts over, the way reopening the dialog does. */
function mount(
  overrides: Partial<Parameters<typeof Lightbox>[0]> = {},
): () => void {
  hookState.states = [];
  hookState.refs = [];
  hookState.callbacks = [];
  render(overrides);
  return () => render(overrides);
}

function render(
  overrides: Partial<Parameters<typeof Lightbox>[0]> = {},
): void {
  hookState.stateIndex = 0;
  hookState.refIndex = 0;
  hookState.callbackIndex = 0;

  const tree = Lightbox({
    open: true,
    onOpenChange: () => {},
    imageUrls: URLS,
    blurDataUrls: BLURS,
    title: "Ivory A-line",
    startIndex: 0,
    variant: "inspector",
    ...overrides,
  });

  const content = collect(tree).find(
    (node) =>
      typeof node.type === "function" && node.type.name === "LightboxContent",
  );
  if (!content) throw new Error("no LightboxContent rendered");
  element = (content.type as (p: Record<string, unknown>) => unknown)(
    content.props,
  );
}

function nodes(): RenderedNode[] {
  return collect(element);
}

function button(label: string): RenderedNode | undefined {
  return nodes().find(
    (node) => node.type === "button" && node.props["aria-label"] === label,
  );
}

function requireButton(label: string): RenderedNode {
  const found = button(label);
  if (!found) throw new Error(`no button labelled "${label}"`);
  return found;
}

function click(label: string, rerender: () => void): void {
  const onClick = requireButton(label).props.onClick as () => void;
  onClick();
  rerender();
}

function text(): string {
  return nodes()
    .flatMap((node) => {
      const children = node.props.children;
      return Array.isArray(children) ? children : [children];
    })
    .filter((child): child is string | number =>
      typeof child === "string" || typeof child === "number",
    )
    .join("");
}

beforeEach(() => {
  hookState.states = [];
  hookState.refs = [];
  hookState.callbacks = [];
  element = null;
});

describe("clampZoom", () => {
  it("holds the range the wheel, the pinch, and the buttons all share", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
  });
});

describe("Lightbox: stepping through photos", () => {
  it("disables the back arrow on the first photo and the forward arrow on the last", () => {
    mount({ startIndex: 0 });
    expect(requireButton("Previous photo").props.disabled).toBe(true);
    expect(requireButton("Next photo").props.disabled).toBe(false);

    mount({ startIndex: 2 });
    expect(requireButton("Previous photo").props.disabled).toBe(false);
    expect(requireButton("Next photo").props.disabled).toBe(true);
  });

  it("steps forward and back rather than looping", () => {
    const rerender = () => render({ startIndex: 0 });
    render({ startIndex: 0 });

    click("Next photo", rerender);
    expect(text()).toContain("Photo 2 of 3");

    click("Next photo", rerender);
    expect(text()).toContain("Photo 3 of 3");
    expect(requireButton("Next photo").props.disabled).toBe(true);

    click("Previous photo", rerender);
    expect(text()).toContain("Photo 2 of 3");
  });

  it("hides the arrows entirely at one photo", () => {
    render({ imageUrls: [URLS[0]], blurDataUrls: [BLURS[0]] });
    expect(button("Previous photo")).toBeUndefined();
    expect(button("Next photo")).toBeUndefined();
    expect(text()).toContain("Photo 1 of 1");
  });

  it("steps with the arrow keys, which neither surface had", () => {
    const rerender = () => render({ startIndex: 0 });
    render({ startIndex: 0 });

    const press = (key: string) => {
      const frame = nodes().find(
        (node) => typeof node.props.onKeyDown === "function",
      );
      if (!frame) throw new Error("nothing handles a key press");
      (
        frame.props.onKeyDown as (e: {
          key: string;
          preventDefault: () => void;
        }) => void
      )({ key, preventDefault: () => {} });
      rerender();
    };

    press("ArrowRight");
    expect(text()).toContain("Photo 2 of 3");

    press("ArrowLeft");
    expect(text()).toContain("Photo 1 of 3");

    press("a");
    expect(text()).toContain("Photo 1 of 3");
  });
});

describe("Lightbox: zoom controls", () => {
  it("clamps at fit and at the maximum", () => {
    const rerender = () => render({ startIndex: 0 });
    render({ startIndex: 0 });

    expect(text()).toContain("100%");
    expect(requireButton("Zoom out").props.disabled).toBe(true);

    for (let i = 0; i < 20; i++) click("Zoom in", rerender);
    expect(text()).toContain(`${MAX_ZOOM * 100}%`);
    expect(requireButton("Zoom in").props.disabled).toBe(true);

    for (let i = 0; i < 20; i++) click("Zoom out", rerender);
    expect(text()).toContain("100%");
    expect(requireButton("Zoom out").props.disabled).toBe(true);
  });

  it("resets zoom and pan with Fit", () => {
    const rerender = () => render({ startIndex: 0 });
    render({ startIndex: 0 });

    click("Zoom in", rerender);
    click("Zoom in", rerender);
    expect(text()).toContain("200%");
    expect(requireButton("Fit photo to the frame").props.disabled).toBe(false);

    click("Fit photo to the frame", rerender);
    expect(text()).toContain("100%");
    expect(requireButton("Fit photo to the frame").props.disabled).toBe(true);
  });

  // Codex finding 3: an arrow inside the zoom surface would cycle the zoom as
  // well as navigate, because click-to-cycle fires on any drag-free mouse-up.
  it("does not change the zoom level when navigating", () => {
    const rerender = () => render({ startIndex: 0 });
    render({ startIndex: 0 });

    click("Next photo", rerender);
    expect(text()).toContain("100%");
  });

  it("keeps every control's mouse-up off the zoom surface", () => {
    render({ startIndex: 0 });

    for (const label of [
      "Previous photo",
      "Next photo",
      "Zoom in",
      "Zoom out",
      "Fit photo to the frame",
    ]) {
      const stopPropagation = vi.fn();
      const onMouseUp = requireButton(label).props.onMouseUp as (e: {
        stopPropagation: () => void;
      }) => void;
      expect(onMouseUp).toBeTypeOf("function");
      onMouseUp({ stopPropagation });
      expect(stopPropagation).toHaveBeenCalled();
    }
  });

  it("puts the zoom and pan handlers on the image surface, not on a control's ancestor", () => {
    render({ startIndex: 0 });

    const surface = nodes().find(
      (node) => typeof node.props.onWheel === "function",
    );
    if (!surface) throw new Error("no zoom surface rendered");

    const inside = collect(surface.props.children).filter(
      (node) => node.type === "button",
    );
    expect(inside).toHaveLength(0);
  });
});

describe("Lightbox: the two treatments", () => {
  it("names the listing and counts the photos in the inspector header", () => {
    render({ startIndex: 1 });
    expect(text()).toContain("Ivory A-line");
    expect(text()).toContain("Photo 2 of 3");
  });

  it("keeps the buyer's thumbnail rail and dots, and gains the arrows", () => {
    render({ variant: "overlay", startIndex: 0 });

    expect(button("View photo 1")).toBeDefined();
    expect(button("View photo 3")).toBeDefined();
    expect(requireButton("Previous photo").props.disabled).toBe(true);
    // The buyer surface deliberately opts out of the visible zoom toolbar.
    expect(button("Zoom in")).toBeUndefined();
  });

  // Radix moves initial focus to the first tabbable child of DialogContent, so
  // a close button rendered outside the keydown surface eats the arrow keys.
  it.each(["overlay", "inspector"] as const)(
    "keeps the %s close button inside the keydown surface",
    (variant) => {
      render({ variant, startIndex: 0 });

      const frame = nodes().find(
        (node) => typeof node.props.onKeyDown === "function",
      );
      if (!frame) throw new Error("nothing handles a key press");

      expect(
        collect(frame.props.children).some(
          (node) => node.props["aria-label"] === "Close",
        ),
      ).toBe(true);
    },
  );

  it("jumps to a thumbnail on the buyer surface", () => {
    const rerender = () => render({ variant: "overlay", startIndex: 0 });
    render({ variant: "overlay", startIndex: 0 });

    click("View photo 3", rerender);
    expect(requireButton("Next photo").props.disabled).toBe(true);
    expect(requireButton("Previous photo").props.disabled).toBe(false);
  });
});
