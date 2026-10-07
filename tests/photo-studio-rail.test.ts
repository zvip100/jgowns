import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expand, findAll, textOf } from "./support/react-hook-harness";

import type { ReactNode } from "react";
import type { EditableImage, PhotoStudioItem } from "@/lib/types";

type DropzoneOptions = { onDrop: (files: File[]) => void; disabled?: boolean; multiple?: boolean };
type SortProps = { onMove: (from: number, to: number) => void; onDraggingChange: (isDragging: boolean) => void };

const { dropzones, sortProps, sortables } = vi.hoisted(() => ({
  dropzones: [] as DropzoneOptions[],
  sortProps: [] as SortProps[],
  sortables: [] as { id: string; index: number }[],
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", props),
}));
vi.mock("react-dropzone", () => ({
  useDropzone: (options: DropzoneOptions) => {
    dropzones.push(options);
    return {
      getRootProps: (props: Record<string, unknown> = {}) => props,
      getInputProps: () => ({ type: "file" }),
      isDragActive: false,
    };
  },
}));
vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: (input: { id: string; index: number }) => {
    sortables.push(input);
    return { ref: undefined, handleRef: undefined, isDragSource: input.index === 1 };
  },
}));
vi.mock("@/components/photo-studio/PhotoSortProvider", () => ({
  PhotoSortProvider: (props: SortProps & { children: ReactNode }) => {
    sortProps.push(props);
    return props.children;
  },
}));

import { PhotoStudioRail } from "@/components/photo-studio/PhotoStudioRail";
import { initialEdits } from "@/components/photo-studio/photo-studio-draft";

const IMAGE: EditableImage = { src: "blob:new", width: 1500, height: 2000, name: "new.jpg" };
const UPLOADED: PhotoStudioItem = { id: "a", kind: "uploaded", url: "https://cdn.example.com/a.avif" };
const NEW: PhotoStudioItem = { id: "b", kind: "new", image: IMAGE, edits: { ...initialEdits(IMAGE), brightness: 20 } };

const onSelect = vi.fn();
const onRemove = vi.fn();
const onMove = vi.fn();
const onAddFiles = vi.fn();
const onDraggingChange = vi.fn();

function render(items: PhotoStudioItem[], { remaining = 1, note = "", activeId = "a" } = {}) {
  dropzones.length = 0;
  sortProps.length = 0;
  sortables.length = 0;
  const tree = expand(
    React,
    React.createElement(PhotoStudioRail, {
      items,
      activeId,
      remaining,
      note,
      onSelect,
      onRemove,
      onMove,
      onAddFiles,
      onDraggingChange,
    }),
  );
  return {
    tree,
    text: textOf(React, tree),
    byLabel: (label: string) => findAll(React, tree, (props) => props["aria-label"] === label)[0]?.props,
  };
}

beforeEach(() => {
  [onSelect, onRemove, onMove, onAddFiles, onDraggingChange].forEach((fn) => fn.mockReset());
});

describe("PhotoStudioRail", () => {
  it("labels each thumbnail with its position, the cover and published state", () => {
    const view = render([UPLOADED, NEW]);
    expect(view.byLabel("Photo 1, cover, published")).toBeDefined();
    expect(view.byLabel("Photo 2")).toBeDefined();
    expect(view.text).toContain("Cover");
    expect(sortables).toEqual([
      { id: "a", index: 0 },
      { id: "b", index: 1 },
    ]);
  });

  it("marks the active photo and selects or removes one", () => {
    const view = render([UPLOADED, NEW], { activeId: "b" });
    expect(view.byLabel("Photo 1, cover, published")["aria-current"]).toBeUndefined();
    expect(view.byLabel("Photo 2")["aria-current"]).toBe(true);

    (view.byLabel("Photo 2").onClick as () => void)();
    (view.byLabel("Remove photo 1").onClick as () => void)();
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("previews brightness on a new photo's thumbnail", () => {
    const [newThumb] = findAll(React, render([UPLOADED, NEW]).tree, (props) => props.src === "blob:new");
    expect(newThumb.props.style).toEqual({ filter: "brightness(1.2)" });
  });

  it("lifts the photo being dragged and shows the grabbing cursor on it", () => {
    const [lifted] = findAll(React, render([UPLOADED, NEW]).tree, (props) =>
      String(props.className ?? "").includes("**:cursor-grabbing"),
    );
    expect(lifted).toBeDefined();
  });

  it("passes reorders and the dragging state through", () => {
    render([UPLOADED, NEW]);
    sortProps[0].onMove(1, 0);
    sortProps[0].onDraggingChange(true);
    expect(onMove).toHaveBeenCalledWith(1, 0);
    expect(onDraggingChange).toHaveBeenCalledWith(true);
  });

  it("adds photos from the add tile while there is room", () => {
    const view = render([NEW], { remaining: 2 });
    expect(view.byLabel("Add photos")).toBeDefined();
    expect(dropzones[0]).toMatchObject({ multiple: true, disabled: false });

    const file = new File([new Uint8Array(1)], "c.jpg", { type: "image/jpeg" });
    dropzones[0].onDrop([file]);
    dropzones[0].onDrop([]);
    expect(onAddFiles).toHaveBeenCalledExactlyOnceWith([file]);
  });

  it("hides the add tile and disables drops when full", () => {
    const view = render([UPLOADED, NEW], { remaining: 0 });
    expect(view.byLabel("Add photos")).toBeUndefined();
    expect(dropzones[0].disabled).toBe(true);
  });

  it("shows a note, and the reorder hint only with two or more photos", () => {
    expect(render([NEW], { note: "Up to 3 photos." }).text).toContain("Up to 3 photos.");
    expect(render([NEW]).text).not.toContain("Drag to reorder");
    expect(render([UPLOADED, NEW]).text).toContain("Drag to reorder");
  });
});
