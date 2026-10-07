import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement, ReactNode } from "react";
import type { EditableImage, ImageSlotState, PhotoEdits, PhotoStudioItem } from "@/lib/types";

type DropzoneOptions = {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
};

type StudioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItems: PhotoStudioItem[];
  initialIndex: number;
  initialFiles?: File[];
  maxItems: number;
  mode: string;
  onSave: (items: PhotoStudioItem[]) => void;
};

const { hookState, dropzones, studioProps, sortProps } = vi.hoisted(() => ({
  hookState: { states: [] as unknown[], index: 0 },
  dropzones: [] as DropzoneOptions[],
  studioProps: [] as StudioProps[],
  sortProps: [] as { onMove: (from: number, to: number) => void }[],
}));

/** State persists across renders by call order, like React's own. */
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: <State>(initial: State): [State, (next: unknown) => void] => {
      const index = hookState.index++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      return [
        hookState.states[index] as State,
        (next: unknown) => {
          hookState.states[index] =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(hookState.states[index])
              : next;
        },
      ];
    },
  };
});

vi.mock("next/image", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      react.createElement("img", { src, alt }),
  };
});

vi.mock("react-dropzone", () => ({
  useDropzone: (options: DropzoneOptions) => {
    dropzones.push(options);
    return {
      getRootProps: (props: Record<string, unknown> = {}) => props,
      getInputProps: (props: Record<string, unknown> = {}) => ({ type: "file", ...props }),
      isDragActive: false,
      isDragReject: false,
    };
  },
}));

vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({ ref: undefined, handleRef: undefined, isDragSource: false }),
}));

vi.mock("@/components/photo-studio/PhotoSortProvider", () => ({
  PhotoSortProvider: (props: { onMove: (from: number, to: number) => void; children: ReactNode }) => {
    sortProps.push(props);
    return props.children;
  },
}));

vi.mock("@/components/photo-studio/PhotoStudioDialog", () => ({
  PhotoStudioDialog: (props: StudioProps) => {
    studioProps.push(props);
    return null;
  },
}));

import { ListingPhotoField } from "@/components/ListingPhotoField";

const EDITS: PhotoEdits = {
  framing: "crop",
  crop: { x: 0, y: 0, width: 300, height: 400 },
  rotation90: 0,
  tilt: 0,
  brightness: 0,
  zoom: 1,
  position: { x: 0, y: 0 },
};
const SOURCE: EditableImage = { src: "blob:source", width: 300, height: 400, name: "a.jpg" };
const EXISTING = "https://cdn.example.com/existing.avif";

function makeSlot(id: string, overrides: Partial<ImageSlotState> = {}): ImageSlotState {
  return {
    id,
    preview: null,
    imageFile: null,
    optimizedDataUrl: null,
    blurPromise: Promise.resolve(null),
    optimizing: false,
    optimizeError: "",
    existingUrl: null,
    source: null,
    edits: null,
    version: 0,
    ...overrides,
  };
}

function existingSlot(id: string): ImageSlotState {
  return makeSlot(id, { preview: EXISTING, existingUrl: EXISTING });
}

function newSlot(id: string, overrides: Partial<ImageSlotState> = {}): ImageSlotState {
  return makeSlot(id, { preview: "data:image/avif;base64,ok", source: SOURCE, edits: EDITS, ...overrides });
}

/** Expands function components into host elements so handlers can be reached. */
function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand);
  if (!React.isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    // A primitive that needs real React hooks stays an element for the real renderer.
    try {
      return expand((element.type as (props: unknown) => ReactNode)(element.props));
    } catch {
      return element;
    }
  }
  if (typeof element.type === "string" || (element.type as unknown) === React.Fragment) {
    return React.cloneElement(element, undefined, expand(element.props.children as ReactNode));
  }
  return element;
}

function findAll(node: ReactNode, match: (props: Record<string, unknown>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, match));
  if (!React.isValidElement(node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  const own = match(element.props) ? [element] : [];
  return [...own, ...findAll(element.props.children as ReactNode, match)];
}

type Field = {
  tree: ReactNode;
  html: string;
  byLabel: (label: string) => ReactElement<Record<string, unknown>>;
};

const onSave = vi.fn();
const onClear = vi.fn();

function render(slots: ImageSlotState[]): Field {
  hookState.index = 0;
  dropzones.length = 0;
  studioProps.length = 0;
  sortProps.length = 0;
  const tree = expand(React.createElement(ListingPhotoField, { slots, onSave, onClear }));
  return {
    tree,
    html: renderToStaticMarkup(tree as ReactElement),
    byLabel: (label) => {
      const [found] = findAll(tree, (props) => props["aria-label"] === label);
      if (!found) throw new Error(`No element labelled ${label}`);
      return found;
    },
  };
}

function studio(): StudioProps {
  return studioProps[studioProps.length - 1];
}

function photo(name = "gown.jpg"): File {
  return new File([new Uint8Array(4)], name, { type: "image/jpeg" });
}

beforeEach(() => {
  hookState.states = [];
  onSave.mockReset();
  onClear.mockReset();
});

describe("ListingPhotoField: an empty field", () => {
  it("shows one wide drop zone that takes several images at once", () => {
    const field = render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);

    expect(dropzones).toHaveLength(1);
    expect(dropzones[0].multiple).toBe(true);
    expect(dropzones[0].accept).toEqual({ "image/*": [] });
    expect(field.html).toContain('aria-label="Add photos"');
    expect(field.html).toContain("Drag photos here");
    expect(field.html).toContain("Up to 3. The first one is your cover.");
    expect(field.html).toContain("Choose photos");
    expect(field.html).not.toContain('aria-label="Add photo"');
    expect(studio().open).toBe(false);
  });

  it("opens the studio with the picked photos, starting at photo 1", () => {
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);
    const files = [photo("a.jpg"), photo("b.jpg")];

    dropzones[0].onDrop(files);
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);

    expect(studio()).toMatchObject({
      open: true,
      initialIndex: 0,
      initialFiles: files,
      initialItems: [],
      maxItems: 3,
      mode: "listing",
    });
  });

  it("ignores a drop with no accepted images", () => {
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);
    dropzones[0].onDrop([]);
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);
    expect(studio().open).toBe(false);
  });

  it("still shows the error of a photo that could not be opened", () => {
    const field = render([
      makeSlot("slot-0", { optimizeError: "This photo can't be opened. Try a JPG or PNG." }),
      makeSlot("slot-1"),
      makeSlot("slot-2"),
    ]);
    expect(field.html).toContain("This photo can&#x27;t be opened. Try a JPG or PNG.");
  });
});

describe("ListingPhotoField: the summary grid", () => {
  const SLOTS = [existingSlot("slot-0"), newSlot("slot-1"), makeSlot("slot-2")];

  it("shows each photo's preview and a button into the studio", () => {
    const field = render(SLOTS);

    expect(field.html).toContain(`src="${EXISTING}"`);
    expect(field.html).toContain('src="data:image/avif;base64,ok"');
    // A published photo is locked in the studio, so its button says what it can do.
    expect(field.html).toContain('aria-label="Move photo 1, cover"');
    expect(field.html).toContain('aria-label="Edit photo 2"');
    expect(field.html).toContain('aria-label="Add photo"');
  });

  it("opens the studio at the photo that was clicked, with every photo in order", () => {
    const field = render(SLOTS);
    (field.byLabel("Edit photo 2").props.onClick as () => void)();
    render(SLOTS);

    expect(studio().open).toBe(true);
    expect(studio().initialIndex).toBe(1);
    expect(studio().initialFiles).toBeUndefined();
    expect(studio().initialItems).toEqual([
      { id: "slot-0", kind: "uploaded", url: EXISTING },
      { id: "slot-1", kind: "new", image: SOURCE, edits: EDITS },
    ]);
  });

  it("adds more photos from an empty slot, after the ones already there", () => {
    render(SLOTS);
    const files = [photo()];
    dropzones[0].onDrop(files);
    render(SLOTS);

    expect(studio()).toMatchObject({ open: true, initialIndex: 2, initialFiles: files });
  });

  it("packs photos past a gap, so positions match the saved order", () => {
    const gapped = [newSlot("slot-0"), makeSlot("slot-1"), existingSlot("slot-2")];
    const field = render(gapped);

    expect(field.html.indexOf("Move photo 2")).toBeLessThan(field.html.indexOf('aria-label="Add photo"'));
    expect(field.html).toContain(">3</span>");
    (field.byLabel("Remove photo 2").props.onClick as () => void)();
    expect(onClear).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("does not open the studio for a published photo, which can only move", () => {
    const field = render(SLOTS);
    expect(field.byLabel("Move photo 1, cover").props.onClick).toBeUndefined();
  });

  it("names the first photo as the cover for screen readers only", () => {
    const field = render(SLOTS);
    expect(field.html).toContain('aria-label="Move photo 1, cover"');
    expect(field.html).not.toContain(">Cover<");
  });

  it("shows the reorder hint only when there is something to reorder", () => {
    expect(render(SLOTS).html).toContain("Drag to reorder. The first photo is your cover.");
    expect(render([newSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]).html).not.toContain(
      "Drag to reorder",
    );
  });

  it("saves a drag as the new photo order", () => {
    render(SLOTS);
    sortProps[0].onMove(1, 0);

    expect(onSave).toHaveBeenCalledExactlyOnceWith([
      { id: "slot-1", kind: "new", image: SOURCE, edits: EDITS },
      { id: "slot-0", kind: "uploaded", url: EXISTING },
    ]);
  });

  it("removes a photo without opening the studio", () => {
    const field = render(SLOTS);
    (field.byLabel("Remove photo 2").props.onClick as () => void)();
    render(SLOTS);

    expect(onClear).toHaveBeenCalledExactlyOnceWith(1);
    expect(studio().open).toBe(false);
  });

  it("covers a photo that is still optimizing and shows its own error under it", () => {
    const field = render([
      newSlot("slot-0", { optimizing: true }),
      newSlot("slot-1", { optimizeError: "Failed to automatically optimize image." }),
      makeSlot("slot-2"),
    ]);

    expect(field.html).toContain("Optimizing image");
    expect(field.html).toContain("Failed to automatically optimize image.");
  });

  it("labels a published photo for moving and a new one for editing", () => {
    const field = render(SLOTS);
    expect(field.html).toContain("Drag to move");
    expect(field.html).toContain(">Edit<");
  });
});

describe("ListingPhotoField: the studio's outcome", () => {
  const SLOTS = [newSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")];

  it("hands the saved order to the form and closes the studio", () => {
    const field = render(SLOTS);
    (field.byLabel("Edit photo 1, cover").props.onClick as () => void)();
    render(SLOTS);

    const items: PhotoStudioItem[] = [{ id: "slot-0", kind: "uploaded", url: EXISTING }];
    studio().onSave(items);
    render(SLOTS);

    expect(onSave).toHaveBeenCalledExactlyOnceWith(items);
    expect(studio().open).toBe(false);
  });

  it("drops the picked files once the studio closes", () => {
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);
    dropzones[0].onDrop([photo()]);
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);

    studio().onOpenChange(false);
    render([makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")]);

    expect(studio().open).toBe(false);
    expect(studio().initialFiles).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
  });
});
