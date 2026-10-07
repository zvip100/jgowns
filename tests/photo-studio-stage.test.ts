import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginRender, expand, findAll, harness, resetHarness, runEffects, textOf } from "./support/react-hook-harness";

import type { EditableImage, PhotoEdits, PhotoStudioItem } from "@/lib/types";

type CropperProps = {
  cropSize: { width: number; height: number };
  zoom: number;
  minZoom: number;
  crop: { x: number; y: number };
  rotation: number;
  restrictPosition: boolean;
  style: { mediaStyle: { filter: string } };
  onCropChange: (location: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
};

const { croppers } = vi.hoisted(() => ({ croppers: [] as CropperProps[] }));

vi.mock("react", async () =>
  (await import("./support/react-hook-harness")).mockReact(await vi.importActual("react")),
);
vi.mock("react-easy-crop", () => ({
  default: (props: CropperProps) => {
    croppers.push(props);
    return null;
  },
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", props),
}));

import { PhotoStudioStage } from "@/components/photo-studio/PhotoStudioStage";
import { initialEdits, positionEdits, zoomEdits } from "@/components/photo-studio/photo-studio-draft";
import { fitZoom, minZoomToCover } from "@/lib/image-upload";

type Update = (edits: PhotoEdits, image: EditableImage) => PhotoEdits;
type Props = Record<string, unknown>;

const PORTRAIT: EditableImage = { src: "blob:portrait", width: 1500, height: 2000, name: "portrait.jpg" };
const WIDE: EditableImage = { src: "blob:wide", width: 2000, height: 1300, name: "wide.jpg" };
const UPLOADED: PhotoStudioItem = { id: "u", kind: "uploaded", url: "https://cdn.example.com/u.avif" };

const onPrev = vi.fn();
const onNext = vi.fn();
const onUpdate = vi.fn<(update: Update) => void>();

function newItem(image: EditableImage, edits: PhotoEdits = initialEdits(image)): PhotoStudioItem {
  return { id: "n", kind: "new", image, edits };
}

/** Seeds the measured stage size and the desktop media query, then renders. */
function render(
  item: PhotoStudioItem,
  { size = { width: 920, height: 730 } as { width: number; height: number } | null, isWide = true, index = 0, count = 1 } = {},
) {
  resetHarness();
  harness.states[0] = size;
  harness.states[1] = isWide;
  croppers.length = 0;
  beginRender();
  const tree = expand(React, React.createElement(PhotoStudioStage, { item, index, count, onPrev, onNext, onUpdate }));
  const all = (match: (props: Props, type: unknown) => boolean) => findAll(React, tree, match);
  return {
    tree,
    cropper: croppers[0],
    lifted: all((props) => (props.style as Props | undefined)?.top !== undefined)[0]?.props,
    byLabel: (label: string) => all((props) => props["aria-label"] === label)[0]?.props,
    swipeZones: all((props) => typeof props.onPointerDown === "function").map((el) => el.props),
  };
}

function lastUpdate(): Update {
  return onUpdate.mock.calls.at(-1)![0];
}

beforeEach(() => {
  [onPrev, onNext, onUpdate].forEach((fn) => fn.mockReset());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PhotoStudioStage: the window", () => {
  it("renders nothing until the stage has been measured", () => {
    expect(render(newItem(PORTRAIT), { size: null }).cropper).toBeUndefined();
  });

  it("fills the desktop stage at exact 3:4, lifted clear of the tool bar", () => {
    const view = render(newItem(PORTRAIT));
    expect(view.cropper.cropSize).toEqual({ width: 477, height: 636 });
    expect(view.lifted.style).toEqual({ top: -60 });
  });

  it("stops growing at the detail page photo size", () => {
    const view = render(newItem(PORTRAIT), { size: { width: 920, height: 1000 } });
    expect(view.cropper.cropSize).toEqual({ width: 486, height: 648 });
  });

  it("is not lifted on phones, where the tool bar sits under the stage", () => {
    const view = render(newItem(PORTRAIT), { size: { width: 390, height: 500 }, isWide: false });
    expect(view.cropper.cropSize).toEqual({ width: 324, height: 432 });
    expect(view.lifted.style).toEqual({ top: -0 });
  });

  it("sizes the photo against the lifted container, so its zoom math matches the cropper's", () => {
    const view = render(newItem(WIDE));
    const media = { width: 920, height: 920 * (1300 / 2000) };
    expect(view.cropper.zoom).toBeCloseTo(
      fitZoom({ mediaWidth: media.width, mediaHeight: media.height, cropWidth: 477, cropHeight: 636, rotation90: 0 }),
    );
    expect(view.cropper.restrictPosition).toBe(false);
  });
});

describe("PhotoStudioStage: editing", () => {
  it("places a crop at its saved position and zoom, with live brightness and rotation", () => {
    const edits: PhotoEdits = { ...initialEdits(PORTRAIT), zoom: 1.5, position: { x: 0.1, y: -0.2 }, tilt: 3, brightness: 10 };
    const view = render(newItem(PORTRAIT, edits));
    const media = { width: 592.5, height: 790 };
    const cover = minZoomToCover({ mediaWidth: media.width, mediaHeight: media.height, cropWidth: 477, cropHeight: 636, rotation: 0 });

    expect(view.cropper.crop).toEqual({ x: 0.1 * 477, y: -0.2 * 636 });
    expect(view.cropper.zoom).toBeCloseTo(1.5 * cover);
    expect(view.cropper.rotation).toBe(3);
    expect(view.cropper.style.mediaStyle.filter).toBe("brightness(1.1)");
  });

  it("stores a pan as a fraction of the window and a zoom relative to the cover", () => {
    const edits = initialEdits(PORTRAIT);
    const view = render(newItem(PORTRAIT, edits));
    view.cropper.onCropChange({ x: 47.7, y: -63.6 });
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(positionEdits(PORTRAIT, edits, { x: 0.1, y: -0.1 }));

    const cover = view.cropper.zoom / edits.zoom;
    view.cropper.onZoomChange(cover * 2);
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(zoomEdits(PORTRAIT, edits, 2));
  });

  it("keeps server framing pinned until the photo really moves", () => {
    const view = render(newItem(WIDE));
    view.cropper.onCropChange({ x: 0.2, y: -0.3 });
    expect(onUpdate).not.toHaveBeenCalled();
    view.cropper.onCropChange({ x: 30, y: 0 });
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("shows a published photo locked in the same window, with its hint and no grid", () => {
    const view = render(UPLOADED);
    expect(view.cropper).toBeUndefined();
    expect(textOf(React, view.tree)).toContain("Published photos can't be edited.");
    const [image] = findAll(React, view.tree, (props) => props.src === UPLOADED.url);
    expect(image.props.sizes).toBe("488px");
  });
});

describe("PhotoStudioStage: moving between photos", () => {
  it("offers previous and next, disabled at the ends and level with the window", () => {
    const view = render(newItem(PORTRAIT), { index: 0, count: 3 });
    expect(view.byLabel("Previous photo").disabled).toBe(true);
    expect(view.byLabel("Next photo").style).toEqual({ marginTop: -30 });
    (view.byLabel("Next photo").onClick as () => void)();
    expect(onNext).toHaveBeenCalledOnce();

    const last = render(newItem(PORTRAIT), { index: 2, count: 3 });
    expect(last.byLabel("Next photo").disabled).toBe(true);
    (last.byLabel("Previous photo").onClick as () => void)();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("has no navigation for a single photo", () => {
    expect(render(newItem(PORTRAIT)).byLabel("Next photo")).toBeUndefined();
  });

  it("swipes from the edge zones, ignoring short moves and cancelled touches", () => {
    const [zone] = render(newItem(PORTRAIT), { size: { width: 390, height: 500 }, isWide: false, count: 2 }).swipeZones;
    const swipe = (from: number, to: number) => {
      (zone.onPointerDown as (event: { clientX: number }) => void)({ clientX: from });
      (zone.onPointerUp as (event: { clientX: number }) => void)({ clientX: to });
    };
    swipe(300, 240);
    swipe(20, 90);
    swipe(100, 110);
    (zone.onPointerUp as (event: { clientX: number }) => void)({ clientX: 0 });
    (zone.onPointerDown as (event: { clientX: number }) => void)({ clientX: 300 });
    (zone.onPointerCancel as () => void)();
    (zone.onPointerUp as (event: { clientX: number }) => void)({ clientX: 0 });

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });
});

describe("PhotoStudioStage: measuring", () => {
  it("tracks the stage size and the desktop breakpoint", () => {
    let resize: (entries: { contentRect: { width: number; height: number } }[]) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resize) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("window", { matchMedia: vi.fn(() => query) });

    render(newItem(PORTRAIT), { size: null, isWide: false });
    harness.refs[0].current = {};
    const cleanups = runEffects();

    resize([{ contentRect: { width: 800, height: 600 } }]);
    const measured = harness.states[0];
    resize([{ contentRect: { width: 800, height: 600 } }]);
    expect(harness.states[0]).toBe(measured);
    expect(measured).toEqual({ width: 800, height: 600 });
    expect(harness.states[1]).toBe(true);

    cleanups.forEach((cleanup) => cleanup());
    expect(disconnect).toHaveBeenCalledOnce();
    expect(query.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("waits for the stage element before observing", () => {
    render(newItem(PORTRAIT), { size: null });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
    expect(() => runEffects()).not.toThrow();
  });
});
