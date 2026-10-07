import { describe, expect, it } from "vitest";

import {
  activeIndexOf,
  brightnessEdits,
  cropAreaFor,
  draftOwnedSource,
  draftOwnedSources,
  editsEqual,
  emptyDraft,
  fitZoomRelative,
  framingFor,
  initialEdits,
  isDraftDirty,
  isEditable,
  moveItem,
  positionEdits,
  remainingSlots,
  rotateEdits,
  studioDraftReducer,
  tiltEdits,
  tooManyPhotosNote,
  zoomEdits,
  zoomFloor,
} from "@/components/photo-studio/photo-studio-draft";

import type { StudioDraft, StudioDraftAction } from "@/components/photo-studio/photo-studio-draft";
import type { EditableImage, PhotoStudioItem } from "@/lib/types";

const PORTRAIT: EditableImage = { src: "blob:portrait", width: 1500, height: 2000, name: "portrait.jpg" };
const NEAR: EditableImage = { src: "blob:near", width: 1200, height: 1500, name: "near.jpg" };
const TALL: EditableImage = { src: "blob:tall", width: 780, height: 2000, name: "tall.jpg" };
const WIDE: EditableImage = { src: "blob:wide", width: 2000, height: 1300, name: "wide.jpg" };
/** Far from 3:4 upright, close to it after a quarter turn. */
const SIDEWAYS: EditableImage = { src: "blob:sideways", width: 2000, height: 1500, name: "sideways.jpg" };

type NewItem = Extract<PhotoStudioItem, { kind: "new" }>;

function newItem(id: string, image: EditableImage = PORTRAIT): NewItem {
  return { id, kind: "new", image, edits: initialEdits(image) };
}

function uploaded(id: string): PhotoStudioItem {
  return { id, kind: "uploaded", url: `https://cdn.example.com/${id}.avif` };
}

function run(draft: StudioDraft, ...actions: StudioDraftAction[]): StudioDraft {
  return actions.reduce(studioDraftReducer, draft);
}

function opened(items: PhotoStudioItem[], maxItems = 3, activeIndex = 0): StudioDraft {
  return run(emptyDraft(), { type: "open", items, maxItems, activeIndex });
}

describe("framing on open (spec §5.1)", () => {
  it("opens a photo close to 3:4 as a centered crop at the cover zoom", () => {
    const edits = initialEdits(NEAR);
    expect(edits.framing).toBe("crop");
    expect(edits.zoom).toBe(1);
    expect(edits.position).toEqual({ x: 0, y: 0 });
    expect(edits.crop).toEqual({ x: 38, y: 0, width: 1125, height: 1500 });
  });

  it("crops an exact 3:4 photo to the whole photo", () => {
    expect(initialEdits(PORTRAIT).crop).toEqual({ x: 0, y: 0, width: 1500, height: 2000 });
  });

  it("opens a very tall or wide photo in server framing with no crop", () => {
    for (const image of [TALL, WIDE]) {
      const edits = initialEdits(image);
      expect(edits.framing).toBe("server");
      expect(edits.crop).toBeNull();
      expect(edits.tilt).toBe(0);
    }
  });

  it("decides on the turned dimensions", () => {
    expect(framingFor(SIDEWAYS, 0)).toBe("server");
    expect(framingFor(SIDEWAYS, 90)).toBe("crop");
    expect(framingFor(SIDEWAYS, 180)).toBe("server");
  });
});

describe("zoom scale", () => {
  it("puts the fit view below 1 whenever bars show", () => {
    expect(fitZoomRelative(TALL, 0)).toBeLessThan(1);
    expect(fitZoomRelative(PORTRAIT, 0)).toBeCloseTo(1);
  });

  it("raises the floor for a tilt so the centered window has no empty corners", () => {
    const edits = initialEdits(PORTRAIT);
    expect(zoomFloor(PORTRAIT, edits)).toBeCloseTo(1);
    expect(zoomFloor(PORTRAIT, { ...edits, tilt: 15 })).toBeGreaterThan(1.3);
    expect(zoomFloor(PORTRAIT, { ...edits, tilt: -15 })).toBeCloseTo(
      zoomFloor(PORTRAIT, { ...edits, tilt: 15 }),
    );
  });
});

describe("framing transitions", () => {
  it("switches a server photo to a crop when it is zoomed past the fit view", () => {
    const server = initialEdits(TALL);
    expect(zoomEdits(TALL, server, fitZoomRelative(TALL, 0))).toBe(server);

    const zoomed = zoomEdits(TALL, server, fitZoomRelative(TALL, 0) + 0.01);
    expect(zoomed.framing).toBe("crop");
    // Starts at the cover zoom, never between fit and cover.
    expect(zoomed.zoom).toBe(1);
    expect(zoomed.crop).not.toBeNull();
  });

  it("lands a slider jump past cover at the requested zoom", () => {
    expect(zoomEdits(TALL, initialEdits(TALL), 2).zoom).toBe(2);
  });

  it("switches a server photo to a centered crop when it is dragged", () => {
    const server = initialEdits(TALL);
    expect(positionEdits(TALL, server, { x: 0, y: 0 })).toBe(server);

    const dragged = positionEdits(TALL, server, { x: 0.1, y: -0.2 });
    expect(dragged.framing).toBe("crop");
    expect(dragged.position).toEqual({ x: 0, y: 0 });
  });

  it("switches a server photo to a crop when it is straightened", () => {
    const server = initialEdits(WIDE);
    expect(tiltEdits(WIDE, server, 0)).toBe(server);

    const tilted = tiltEdits(WIDE, server, 5);
    expect(tilted.framing).toBe("crop");
    expect(tilted.tilt).toBe(5);
    expect(tilted.zoom).toBeCloseTo(zoomFloor(WIDE, tilted));
  });

  it("re-runs the rule when a server photo is rotated", () => {
    const turned = rotateEdits(SIDEWAYS, initialEdits(SIDEWAYS));
    expect(turned.rotation90).toBe(90);
    expect(turned.framing).toBe("crop");

    const stillTall = rotateEdits(TALL, rotateEdits(TALL, initialEdits(TALL)));
    expect(stillTall.rotation90).toBe(180);
    expect(stillTall.framing).toBe("server");
  });

  it("keeps a crop a crop through rotation, cycling 0 to 270 and back", () => {
    let edits = initialEdits(PORTRAIT);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      edits = rotateEdits(PORTRAIT, edits);
      seen.push(edits.rotation90);
      expect(edits.framing).toBe("crop");
    }
    expect(seen).toEqual([90, 180, 270, 0]);
  });

  it("leaves framing alone for brightness, and clamps it", () => {
    const server = initialEdits(TALL);
    expect(brightnessEdits(server, 12).framing).toBe("server");
    expect(brightnessEdits(server, 80).brightness).toBe(30);
    expect(brightnessEdits(server, -80).brightness).toBe(-30);
  });

  it("returns to the opening view on reset", () => {
    const edited = brightnessEdits(rotateEdits(TALL, zoomEdits(TALL, initialEdits(TALL), 2)), 20);
    expect(editsEqual(initialEdits(TALL), edited)).toBe(false);
    expect(initialEdits(TALL).framing).toBe("server");
  });
});

describe("crop limits", () => {
  it("clamps zoom between the floor and 3", () => {
    const edits = initialEdits(PORTRAIT);
    expect(zoomEdits(PORTRAIT, edits, 0.4).zoom).toBe(1);
    expect(zoomEdits(PORTRAIT, edits, 9).zoom).toBe(3);
  });

  it("raises zoom when a tilt needs it, and keeps a higher one", () => {
    const tilted = tiltEdits(PORTRAIT, initialEdits(PORTRAIT), 10);
    expect(tilted.zoom).toBeCloseTo(zoomFloor(PORTRAIT, tilted));
    const zoomed = zoomEdits(PORTRAIT, initialEdits(PORTRAIT), 2.5);
    expect(tiltEdits(PORTRAIT, zoomed, 10).zoom).toBe(2.5);
    expect(tiltEdits(PORTRAIT, zoomed, 40).tilt).toBe(15);
  });

  it("keeps the window on the photo when panned past its edge", () => {
    const zoomed = zoomEdits(PORTRAIT, initialEdits(PORTRAIT), 2);
    const panned = positionEdits(PORTRAIT, zoomed, { x: 5, y: -5 });
    expect(panned.position).toEqual({ x: 0.5, y: -0.5 });
    expect(panned.crop).toEqual({ x: 0, y: 1000, width: 750, height: 1000 });
  });

  it("measures the crop in the turned photo's own pixels", () => {
    const turned = rotateEdits(PORTRAIT, initialEdits(PORTRAIT));
    // 2000x1500 once turned: a 3:4 window is 1125x1500, centered.
    expect(turned.crop).toEqual({ x: 438, y: 0, width: 1125, height: 1500 });
    expect(cropAreaFor(PORTRAIT, turned)).toEqual(turned.crop);
  });
});

describe("editsEqual", () => {
  it("ignores the derived crop and tiny float noise", () => {
    const edits = initialEdits(PORTRAIT);
    expect(editsEqual(edits, { ...edits, crop: null, zoom: 1.0000001 })).toBe(true);
    expect(editsEqual(edits, { ...edits, tilt: 0.5 })).toBe(false);
    expect(editsEqual(edits, null)).toBe(false);
    expect(editsEqual(null, null)).toBe(true);
  });
});

describe("moveItem", () => {
  it("moves one item and leaves the input untouched", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a"]);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("returns the same array for a no-op or an out-of-range move", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 0)).toBe(items);
    expect(moveItem(items, 2, 0)).toBe(items);
    expect(moveItem(items, 0, 2)).toBe(items);
  });
});

describe("studioDraftReducer", () => {
  it("adds up to the remaining room and rejects the extras", () => {
    const draft = run(opened([newItem("a")]), {
      type: "add",
      items: [newItem("b"), newItem("c"), newItem("d")],
    });
    expect(draft.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(draft.activeId).toBe("b");
    expect(remainingSlots(draft)).toBe(0);
    expect(run(draft, { type: "add", items: [newItem("e")] })).toBe(draft);
    expect(tooManyPhotosNote(3)).toBe("Up to 3 photos. Extra photos weren't added.");
  });

  it("removes a photo and moves the selection to its neighbor", () => {
    const draft = run(opened([newItem("a"), newItem("b"), newItem("c")], 3, 2), {
      type: "remove",
      id: "c",
    });
    expect(draft.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(draft.activeId).toBe("b");
    expect(run(draft, { type: "remove", id: "zzz" })).toBe(draft);
  });

  it("reorders uploaded photos too, and the cover follows position 1", () => {
    const draft = run(opened([uploaded("u1"), newItem("b"), uploaded("u2")]), {
      type: "move",
      from: 2,
      to: 0,
    });
    expect(draft.items.map((item) => item.id)).toEqual(["u2", "u1", "b"]);
    expect(draft.items[0].kind).toBe("uploaded");
    expect(run(draft, { type: "move", from: 0, to: 9 })).toBe(draft);
    expect(run(draft, { type: "move", from: 1, to: 1 })).toBe(draft);
  });

  it("keeps the selection on the same photo after a move", () => {
    const draft = run(opened([newItem("a"), newItem("b")], 3, 0), { type: "move", from: 0, to: 1 });
    expect(activeIndexOf(draft)).toBe(1);
  });

  it("never edits an uploaded photo", () => {
    const draft = opened([uploaded("u1")]);
    const next = run(draft, { type: "update", id: "u1", update: (edits) => ({ ...edits, tilt: 5 }) });
    expect(next).toBe(draft);
    expect(isEditable(draft.items[0])).toBe(false);
    expect(isEditable(newItem("a"))).toBe(true);
  });

  it("applies an edit and skips one that changes nothing", () => {
    const draft = opened([newItem("a")]);
    const same = run(draft, { type: "update", id: "a", update: (edits) => edits });
    expect(same).toBe(draft);
    const brighter = run(draft, {
      type: "update",
      id: "a",
      update: (edits) => brightnessEdits(edits, 10),
    });
    expect(brighter.items[0].kind === "new" && brighter.items[0].edits.brightness).toBe(10);
  });

  it("selects only photos that exist and records the rail note", () => {
    const draft = opened([newItem("a"), newItem("b")]);
    expect(run(draft, { type: "select", id: "b" }).activeId).toBe("b");
    expect(run(draft, { type: "select", id: "nope" })).toBe(draft);
    expect(run(draft, { type: "note", message: "Hi" }).note).toBe("Hi");
  });

  it("is rebuilt from scratch on every open", () => {
    const draft = run(opened([newItem("a")]), { type: "note", message: "x" }, { type: "add", items: [newItem("b")] });
    const reopened = run(draft, { type: "open", items: [newItem("a")], maxItems: 3, activeIndex: 0 });
    expect(reopened.items.map((item) => item.id)).toEqual(["a"]);
    expect(reopened.note).toBe("");
    expect(isDraftDirty(reopened)).toBe(false);
  });
});

describe("dirty detection (spec §5.3)", () => {
  it("is clean on open and after a no-op", () => {
    const draft = opened([newItem("a"), uploaded("u")]);
    expect(isDraftDirty(draft)).toBe(false);
    expect(isDraftDirty(run(draft, { type: "select", id: "u" }))).toBe(false);
  });

  it("is dirty after an add, a remove, a move or an edit", () => {
    const draft = opened([newItem("a"), uploaded("u")]);
    expect(isDraftDirty(run(draft, { type: "add", items: [newItem("b")] }))).toBe(true);
    expect(isDraftDirty(run(draft, { type: "remove", id: "u" }))).toBe(true);
    expect(isDraftDirty(run(draft, { type: "move", from: 1, to: 0 }))).toBe(true);
    expect(
      isDraftDirty(
        run(draft, { type: "update", id: "a", update: (edits) => brightnessEdits(edits, 5) }),
      ),
    ).toBe(true);
  });
});

describe("source ownership (spec §4.6)", () => {
  it("owns only the sources added in this session", () => {
    const inherited = newItem("a", PORTRAIT);
    const draft = run(opened([inherited, uploaded("u")]), { type: "add", items: [newItem("b", TALL)] });

    expect(draftOwnedSource(draft, inherited)).toBeNull();
    expect(draftOwnedSource(draft, uploaded("u"))).toBeNull();
    expect(draftOwnedSource(draft, draft.items[2])).toBe("blob:tall");
  });

  it("hands a confirmed discard exactly what this session created", () => {
    const draft = run(
      opened([newItem("a", PORTRAIT)]),
      { type: "add", items: [newItem("b", TALL), newItem("c", WIDE)] },
      { type: "remove", id: "c" },
    );
    expect(draftOwnedSources(draft)).toEqual(["blob:tall"]);
  });
});
