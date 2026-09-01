import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

/**
 * The grid on the repo's react-hook mock harness. Opening the viewer is state,
 * so a "click" is calling the rendered node's onClick and re-rendering.
 */
type RenderedNode = {
  type: unknown;
  key: string | null;
  props: Record<string, unknown>;
};

const { hookState } = vi.hoisted(() => ({
  hookState: { states: [] as unknown[], stateIndex: 0 },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: <State>(
      initial: State,
    ): [State, (next: State) => void] => {
      const index = hookState.stateIndex++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      return [
        hookState.states[index] as State,
        (next: State) => {
          hookState.states[index] = next;
        },
      ];
    },
  };
});

// Each is exercised in its own file; here only the grid's wiring matters.
vi.mock("@/app/(admin)/admin-action-buttons", () => ({
  AdminAddImageButton: "AdminAddImageButton",
  AdminPhotoMoveButton: "AdminPhotoMoveButton",
  AdminRemoveImageButton: "AdminRemoveImageButton",
  AdminReplaceImageButton: "AdminReplaceImageButton",
  AdminReprocessImageButton: "AdminReprocessImageButton",
}));
vi.mock("@/components/lightbox/Lightbox", () => ({ Lightbox: "Lightbox" }));

import { AdminPhotoGrid } from "@/app/(admin)/admin/listings/[id]/AdminPhotoGrid";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const URLS = [
  "https://x.test/1.webp",
  "https://x.test/2.webp",
  "https://x.test/3.webp",
];
const BLURS = ["b1", "b2", "b3"];

function collect(node: unknown, out: RenderedNode[] = []): RenderedNode[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const candidate = node as {
    type?: unknown;
    key?: string | null;
    props?: Record<string, unknown>;
  };
  if (!("type" in candidate)) return out;
  const props = candidate.props ?? {};
  out.push({ type: candidate.type, key: candidate.key ?? null, props });
  collect(props.children, out);
  return out;
}

let element: ReactNode = null;

function render(overrides: Record<string, unknown> = {}): () => void {
  const props = {
    listingId: LISTING_ID,
    title: "Ivory A-line",
    imageUrls: URLS,
    blurDataUrls: BLURS,
    isDemo: false,
    ...overrides,
  } as Parameters<typeof AdminPhotoGrid>[0];

  const draw = () => {
    hookState.stateIndex = 0;
    element = AdminPhotoGrid(props);
  };
  draw();
  return draw;
}

function nodes(): RenderedNode[] {
  return collect(element);
}

function of(type: string): RenderedNode[] {
  return nodes().filter((node) => node.type === type);
}

function thumbnailButton(position: number): RenderedNode {
  const found = nodes().find(
    (node) =>
      node.type === "button" &&
      node.props["aria-label"] === `Open photo ${position} in viewer`,
  );
  if (!found) throw new Error(`no thumbnail button for photo ${position}`);
  return found;
}

beforeEach(() => {
  hookState.states = [];
  element = null;
});

describe("AdminPhotoGrid: the viewer", () => {
  it("renders no viewer until a thumbnail is clicked", () => {
    render();
    expect(of("Lightbox")).toHaveLength(0);
  });

  it("opens at the thumbnail that was clicked", () => {
    const redraw = render();

    (thumbnailButton(3).props.onClick as () => void)();
    redraw();

    const [lightbox] = of("Lightbox");
    expect(lightbox).toBeDefined();
    expect(lightbox.props.startIndex).toBe(2);
    expect(lightbox.props.variant).toBe("inspector");
    expect(lightbox.props.title).toBe("Ivory A-line");
    expect(lightbox.props.imageUrls).toEqual(URLS);
    expect(lightbox.props.blurDataUrls).toEqual(BLURS);
  });

  it("names every thumbnail button, since the thumbnail's own alt is empty", () => {
    render();
    for (const position of [1, 2, 3]) {
      expect(thumbnailButton(position)).toBeDefined();
    }
  });
});

describe("AdminPhotoGrid: the per-photo controls", () => {
  it("renders reprocess, replace, and remove for every photo", () => {
    render();
    expect(of("AdminReprocessImageButton")).toHaveLength(3);
    expect(of("AdminReplaceImageButton")).toHaveLength(3);
    expect(of("AdminRemoveImageButton")).toHaveLength(3);
  });

  it("passes each control a 1-based position, matching the RPC's indexing", () => {
    render();
    expect(
      of("AdminReplaceImageButton").map((node) => node.props.position),
    ).toEqual([1, 2, 3]);
  });

  it("disables the move arrows at each end of the row and nowhere else", () => {
    render();
    const moves = of("AdminPhotoMoveButton");
    expect(moves).toHaveLength(6);

    const state = moves.map((node) => [
      node.props.position,
      node.props.offset,
      node.props.atEnd,
    ]);
    expect(state).toEqual([
      [1, -1, true],
      [1, 1, false],
      [2, -1, false],
      [2, 1, false],
      [3, -1, false],
      [3, 1, true],
    ]);
  });

  // Duplicate URLs in one array are reachable, which is the whole reason the
  // actions carry a returned-array delete guard. Keyed by URL, two cards would
  // share a React key and a move could reconcile pending state onto the wrong
  // slot.
  it("keys every card distinctly even when the same URL appears twice", () => {
    render({
      imageUrls: [URLS[0], URLS[1], URLS[0]],
      blurDataUrls: ["b1", "b2", "b1"],
    });

    const cards = nodes().filter(
      (node) =>
        node.type === "div" &&
        node.props.className === "flex flex-col items-center gap-2",
    );
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((card) => card.key)).size).toBe(3);
    expect(
      of("AdminPhotoMoveButton").map((node) => node.props.position),
    ).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("threads demo mode to every control, so a fixture id is never writable", () => {
    render({ isDemo: true });
    const controls = [
      ...of("AdminPhotoMoveButton"),
      ...of("AdminReprocessImageButton"),
      ...of("AdminReplaceImageButton"),
      ...of("AdminRemoveImageButton"),
      ...of("AdminAddImageButton"),
    ];
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((node) => node.props.isDemo === true)).toBe(true);
  });
});

describe("AdminPhotoGrid: adding", () => {
  it("offers Add below the grid while there is room", () => {
    render({ imageUrls: URLS.slice(0, 2), blurDataUrls: BLURS.slice(0, 2) });
    expect(of("AdminAddImageButton")).toHaveLength(1);
  });

  it("hides Add at three photos, which the RPC also refuses", () => {
    render();
    expect(of("AdminAddImageButton")).toHaveLength(0);
  });

  it("still offers Add on a listing with no photos at all", () => {
    render({ imageUrls: [], blurDataUrls: [] });
    expect(of("AdminAddImageButton")).toHaveLength(1);
    expect(of("AdminReplaceImageButton")).toHaveLength(0);
  });
});
