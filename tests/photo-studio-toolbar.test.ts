import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { beginRender, expand, findAll, harness, resetHarness, runEffects, textOf } from "./support/react-hook-harness";

import type { ReactNode } from "react";
import type { EditableImage, PhotoEdits, PhotoStudioItem } from "@/lib/types";

vi.mock("react", async () =>
  (await import("./support/react-hook-harness")).mockReact(await vi.importActual("react")),
);
vi.mock("@/components/ui/slider", () => ({
  Slider: (props: Record<string, unknown>) => React.createElement("slider-stub", props),
}));
vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: (props: Record<string, unknown> & { children: ReactNode }) =>
    React.createElement("toggle-group-stub", props),
  ToggleGroupItem: (props: Record<string, unknown> & { children: ReactNode }) =>
    React.createElement("toggle-item-stub", props),
}));

import { PhotoStudioToolbar } from "@/components/photo-studio/PhotoStudioToolbar";
import {
  brightnessEdits,
  initialEdits,
  rotateEdits,
  tiltEdits,
  zoomEdits,
  zoomFloor,
} from "@/components/photo-studio/photo-studio-draft";

type Update = (edits: PhotoEdits, image: EditableImage) => PhotoEdits;
type Props = Record<string, unknown>;

const PORTRAIT: EditableImage = { src: "blob:portrait", width: 1500, height: 2000, name: "portrait.jpg" };
const WIDE: EditableImage = { src: "blob:wide", width: 2000, height: 1300, name: "wide.jpg" };

const onUpdate = vi.fn<(update: Update) => void>();
const onRemove = vi.fn();

function newItem(image: EditableImage, edits: PhotoEdits = initialEdits(image)): PhotoStudioItem {
  return { id: "photo", kind: "new", image, edits };
}

function render(item: PhotoStudioItem | undefined, withRemove = false) {
  beginRender();
  const tree = expand(
    React,
    React.createElement(PhotoStudioToolbar, { item, onUpdate, onRemove: withRemove ? onRemove : undefined }),
  );
  const one = (match: (props: Props, type: unknown) => boolean) => findAll(React, tree, match)[0];
  return {
    tree,
    slider: one((_props, type) => type === "slider-stub").props,
    toggle: one((_props, type) => type === "toggle-group-stub").props,
    readout: textOf(React, one((_props, type) => type === "output")),
    button: (label: string) => one((props) => props["aria-label"] === label)?.props,
  };
}

function lastUpdate(): Update {
  return onUpdate.mock.calls.at(-1)![0];
}

beforeEach(() => {
  resetHarness();
  onUpdate.mockReset();
  onRemove.mockReset();
});

describe("PhotoStudioToolbar: zoom", () => {
  it("reads Fit for a photo on server framing and starts the slider at its fit", () => {
    const view = render(newItem(WIDE));
    expect(view.readout).toBe("Fit");
    expect(view.slider).toMatchObject({ max: 3, disabled: false, "aria-label": "Zoom" });
    expect(view.slider.value).toEqual([view.slider.min]);
  });

  it("reads the crop zoom and floors the slider at the straighten cover", () => {
    const edits = { ...initialEdits(PORTRAIT), zoom: 1.5 };
    const view = render(newItem(PORTRAIT, edits));
    expect(view.readout).toBe("1.5×");
    expect(view.slider).toMatchObject({ min: zoomFloor(PORTRAIT, edits), value: [1.5], step: 0.05 });
  });

  it("applies a slider move through the zoom rule", () => {
    const edits = initialEdits(PORTRAIT);
    const view = render(newItem(PORTRAIT, edits));
    (view.slider.onValueChange as (value: number[]) => void)([2]);
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(zoomEdits(PORTRAIT, edits, 2));
  });

  it("ignores an empty slider value", () => {
    const view = render(newItem(PORTRAIT));
    (view.slider.onValueChange as (value: number[]) => void)([]);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("PhotoStudioToolbar: straighten and brightness", () => {
  it("switches the slider to straighten with a signed degree readout", () => {
    const edits = { ...initialEdits(PORTRAIT), tilt: 4 };
    (render(newItem(PORTRAIT, edits)).toggle.onValueChange as (value: string) => void)("tilt");
    const view = render(newItem(PORTRAIT, edits));

    expect(view.readout).toBe("+4°");
    expect(view.slider).toMatchObject({ min: -15, max: 15, step: 0.5, "aria-label": "Straighten" });
    (view.slider.onValueChange as (value: number[]) => void)([-3]);
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(tiltEdits(PORTRAIT, edits, -3));
  });

  it("switches the slider to brightness with a signed percent readout", () => {
    const edits = { ...initialEdits(PORTRAIT), brightness: -10 };
    (render(newItem(PORTRAIT, edits)).toggle.onValueChange as (value: string) => void)("brightness");
    const view = render(newItem(PORTRAIT, edits));

    expect(view.readout).toBe("-10%");
    expect(view.slider).toMatchObject({ min: -30, max: 30, "aria-label": "Brightness" });
    (view.slider.onValueChange as (value: number[]) => void)([12]);
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(brightnessEdits(edits, 12));
  });

  it("keeps the current tool when the active toggle is pressed again", () => {
    (render(newItem(PORTRAIT)).toggle.onValueChange as (value: string) => void)("");
    expect(render(newItem(PORTRAIT)).slider["aria-label"]).toBe("Zoom");
  });
});

describe("PhotoStudioToolbar: buttons", () => {
  it("rotates and resets through the shared rules", () => {
    const edits = { ...initialEdits(PORTRAIT), tilt: 5, brightness: 8 };
    const view = render(newItem(PORTRAIT, edits));

    (view.button("Rotate 90°")!.onClick as () => void)();
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(rotateEdits(PORTRAIT, edits));
    (view.button("Reset")!.onClick as () => void)();
    expect(lastUpdate()(edits, PORTRAIT)).toEqual(initialEdits(PORTRAIT));
  });

  it("shows Remove photo only when the studio has no rail", () => {
    expect(render(newItem(PORTRAIT)).button("Remove photo")).toBeUndefined();
    const view = render(newItem(PORTRAIT), true);
    (view.button("Remove photo")!.onClick as () => void)();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(render(undefined, true).button("Remove photo")!.disabled).toBe(true);
  });

  it("locks every tool for a published photo", () => {
    const view = render({ id: "published", kind: "uploaded", url: "https://cdn.example.com/a.avif" });
    expect(view.readout).toBe("");
    expect(view.slider.disabled).toBe(true);
    expect(view.toggle.disabled).toBe(true);
    expect(view.button("Rotate 90°")!.disabled).toBe(true);
    expect(view.button("Reset")!.disabled).toBe(true);
    (view.slider.onValueChange as (value: number[]) => void)([2]);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("PhotoStudioToolbar: slider name", () => {
  it("names the focusable thumb after the active tool", () => {
    render(newItem(PORTRAIT));
    const thumb = { setAttribute: vi.fn() };
    harness.refs[0].current = { querySelector: (selector: string) => (selector === '[role="slider"]' ? thumb : null) };
    runEffects();
    expect(thumb.setAttribute).toHaveBeenCalledWith("aria-label", "Zoom");
  });

  it("does nothing before the slider has mounted", () => {
    render(newItem(PORTRAIT));
    expect(() => runEffects()).not.toThrow();
  });
});
