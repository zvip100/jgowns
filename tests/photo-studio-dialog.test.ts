import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginRender, expand, findAll, harness, resetHarness, runEffects, textOf } from "./support/react-hook-harness";

import type { ReactNode } from "react";
import type { EditableImage, PhotoEdits, PhotoStudioItem } from "@/lib/types";

type Captured = Record<string, unknown>;
type DropzoneOptions = { onDrop: (files: File[]) => void; multiple: boolean };

const { captured, openEditableImage } = vi.hoisted(() => ({
  captured: { rail: [] as Captured[], stage: [] as Captured[], toolbar: [] as Captured[], content: [] as Captured[], dialog: [] as Captured[], dropzones: [] as DropzoneOptions[] },
  openEditableImage: vi.fn(),
}));

vi.mock("react", async () =>
  (await import("./support/react-hook-harness")).mockReact(await vi.importActual("react")),
);
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (props: Captured & { children: ReactNode }) => {
    captured.dialog.push(props);
    return props.children;
  },
  DialogContent: (props: Captured & { children: ReactNode }) => {
    captured.content.push(props);
    return React.createElement("section", null, props.children);
  },
  DialogTitle: (props: { children: ReactNode }) => React.createElement("h2", null, props.children),
  DialogDescription: (props: { children: ReactNode }) => React.createElement("p", null, props.children),
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: Captured & { children: ReactNode }) => React.createElement("button", props),
}));
vi.mock("react-dropzone", () => ({
  useDropzone: (options: DropzoneOptions) => {
    captured.dropzones.push(options);
    return {
      getRootProps: (props: Captured = {}) => props,
      getInputProps: () => ({ type: "file" }),
      isDragActive: false,
      open: vi.fn(),
    };
  },
}));
vi.mock("@/components/photo-studio/PhotoStudioRail", () => ({
  PhotoStudioRail: (props: Captured) => {
    captured.rail.push(props);
    return null;
  },
}));
vi.mock("@/components/photo-studio/PhotoStudioStage", () => ({
  PhotoStudioStage: (props: Captured) => {
    captured.stage.push(props);
    return null;
  },
}));
vi.mock("@/components/photo-studio/PhotoStudioToolbar", () => ({
  PhotoStudioToolbar: (props: Captured) => {
    captured.toolbar.push(props);
    return null;
  },
}));
vi.mock("@/lib/image-upload", async () => ({
  ...(await vi.importActual<typeof import("@/lib/image-upload")>("@/lib/image-upload")),
  openEditableImage,
}));

import { PhotoStudioDialog } from "@/components/photo-studio/PhotoStudioDialog";
import { initialEdits, tooManyPhotosNote } from "@/components/photo-studio/photo-studio-draft";
import { UNREADABLE_PHOTO_ERROR } from "@/lib/image-upload";

type DialogProps = React.ComponentProps<typeof PhotoStudioDialog>;
type Update = (edits: PhotoEdits, image: EditableImage) => PhotoEdits;

const PORTRAIT: EditableImage = { src: "blob:portrait", width: 1500, height: 2000, name: "portrait.jpg" };
const UPLOADED: PhotoStudioItem = { id: "u", kind: "uploaded", url: "https://cdn.example.com/u.avif" };
const NEW: PhotoStudioItem = { id: "n", kind: "new", image: PORTRAIT, edits: initialEdits(PORTRAIT) };

const onOpenChange = vi.fn();
const revokeObjectURL = vi.fn();

function image(name: string): EditableImage {
  return { src: `blob:${name}`, width: 1500, height: 2000, name };
}

function file(name: string): File {
  return new File([new Uint8Array(1)], name, { type: "image/jpeg" });
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => (resolve = done));
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function props(overrides: Partial<DialogProps> = {}): DialogProps {
  return { open: true, onOpenChange, initialItems: [UPLOADED, NEW], maxItems: 3, mode: "listing", onSave: vi.fn(), ...overrides };
}

/** Renders twice, since the open-time draft is built during render. */
function render(dialogProps: DialogProps) {
  for (const list of Object.values(captured)) list.length = 0;
  beginRender();
  expand(React, React.createElement(PhotoStudioDialog, dialogProps));
  for (const list of Object.values(captured)) list.length = 0;
  beginRender();
  const tree = expand(React, React.createElement(PhotoStudioDialog, dialogProps));
  const all = (match: (props: Captured, type: unknown) => boolean) => findAll(React, tree, match);
  return {
    tree,
    text: textOf(React, tree),
    rail: captured.rail.at(-1),
    stage: captured.stage.at(-1),
    toolbar: captured.toolbar.at(-1),
    content: captured.content.at(-1)!,
    dialog: captured.dialog.at(-1)!,
    editingArea: all((p) => String(p.className ?? "").startsWith("flex min-h-0 flex-1 flex-col sm:flex-row"))[0].props,
    main: all((p) => String(p.className ?? "") === "flex min-h-0 flex-1 flex-col")[0].props,
    button: (text: string) => all((p, type) => type === "button" && textOf(React, p.children as ReactNode).includes(text))[0]?.props,
    byLabel: (label: string) => all((p) => p["aria-label"] === label)[0]?.props,
  };
}

function railItems(view: ReturnType<typeof render>): PhotoStudioItem[] {
  return view.rail!.items as PhotoStudioItem[];
}

beforeEach(() => {
  resetHarness();
  onOpenChange.mockReset();
  openEditableImage.mockReset();
  revokeObjectURL.mockReset();
  vi.stubGlobal("URL", { ...URL, revokeObjectURL });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PhotoStudioDialog: opening", () => {
  it("builds the draft from the photos it was given, at the requested photo", () => {
    const view = render(props({ initialIndex: 1 }));
    expect(railItems(view)).toEqual([UPLOADED, NEW]);
    expect(view.rail!.remaining).toBe(1);
    expect(view.stage!.item).toEqual(NEW);
    expect(view.text).toContain("Your photos");
    expect(view.text).toContain("Photo 2 of 2");
  });

  it("names photo 1 as the cover in the counter", () => {
    expect(render(props()).text).toContain("Photo 1 of 2 · Cover");
  });

  it("forgets the session once closed, so the next open starts fresh", () => {
    render(props());
    render(props({ open: false }));
    expect(harness.states[1]).toBe(false);
  });

  it("moves between photos from the stage", () => {
    const view = render(props());
    (view.stage!.onNext as () => void)();
    expect(render(props()).stage!.item).toEqual(NEW);
    (render(props()).stage!.onPrev as () => void)();
    expect(render(props()).stage!.item).toEqual(UPLOADED);
  });
});

describe("PhotoStudioDialog: saving", () => {
  it("hands over the ordered photos and locks editing until the save settles", async () => {
    const pending = deferred<string | void>();
    const onSave = vi.fn(() => pending.promise);
    const view = render(props({ onSave }));
    expect(view.editingArea.inert).toBe(false);

    (view.button("Save photos")!.onClick as () => void)();
    expect(onSave).toHaveBeenCalledWith([UPLOADED, NEW]);
    const saving = render(props({ onSave }));
    expect(saving.editingArea.inert).toBe(true);
    expect(saving.button("Saving…")!.disabled).toBe(true);
    expect(saving.button("Cancel")!.disabled).toBe(true);
    (saving.byLabel("Close")!.onClick as () => void)();
    expect(onOpenChange).not.toHaveBeenCalled();

    pending.resolve("Choose a photo.");
    await flush();
    const after = render(props({ onSave }));
    expect(after.editingArea.inert).toBe(false);
    expect(after.rail!.note).toBe("Choose a photo.");
  });

  it("ignores a second Save while the first is running", () => {
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    const view = render(props({ onSave }));
    (view.button("Save photos")!.onClick as () => void)();
    (render(props({ onSave })).button("Saving…")!.onClick as () => void)();
    expect(onSave).toHaveBeenCalledOnce();
  });
});

describe("PhotoStudioDialog: closing", () => {
  it("closes at once when nothing changed", () => {
    (render(props()).byLabel("Close")!.onClick as () => void)();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("asks before discarding changes, and Escape or Keep editing goes back", () => {
    (render(props({ initialIndex: 1 })).toolbar!.onUpdate as (update: Update) => void)((edits) => ({ ...edits, brightness: 10 }));
    (render(props()).byLabel("Close")!.onClick as () => void)();

    const asking = render(props());
    expect(asking.text).toContain("Discard changes?");
    expect(asking.main.inert).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    (asking.content.onEscapeKeyDown as (event: { preventDefault: () => void }) => void)({ preventDefault() {} });
    expect(render(props()).text).not.toContain("Discard changes?");

    (render(props()).byLabel("Close")!.onClick as () => void)();
    (render(props()).button("Keep editing")!.onClick as () => void)();
    expect(render(props()).text).not.toContain("Discard changes?");
  });

  it("discarding frees the photos added in this session and closes", async () => {
    openEditableImage.mockResolvedValue(image("added"));
    (render(props()).rail!.onAddFiles as (files: File[]) => void)([file("added.jpg")]);
    await flush();
    (render(props()).byLabel("Close")!.onClick as () => void)();
    (render(props()).button("Discard")!.onClick as () => void)();

    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:added");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("leaves Escape to the reorder while a photo is being dragged", () => {
    (render(props()).rail!.onDraggingChange as (isDragging: boolean) => void)(true);
    const preventDefault = vi.fn();
    (render(props()).content.onEscapeKeyDown as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on an outside click but not on an outside focus", () => {
    const view = render(props());
    const outside = (type: string) =>
      (view.content.onInteractOutside as (event: Captured) => void)({ preventDefault() {}, detail: { originalEvent: { type } } });
    outside("focusin");
    expect(onOpenChange).not.toHaveBeenCalled();
    outside("pointerdown");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("routes the dialog's own open changes through the same close rules", () => {
    const view = render(props());
    (view.dialog.onOpenChange as (open: boolean) => void)(true);
    (view.dialog.onOpenChange as (open: boolean) => void)(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

describe("PhotoStudioDialog: photos picked before opening", () => {
  it("adds them once, even when a hidden route comes back with the studio open", async () => {
    openEditableImage.mockResolvedValue(image("picked"));
    const picked = [file("picked.jpg")];
    render(props({ initialItems: [], initialFiles: picked }));
    const cleanups = runEffects();
    await flush();
    expect(railItems(render(props({ initialItems: [], initialFiles: picked })))).toHaveLength(1);

    cleanups.forEach((cleanup) => cleanup());
    render(props({ initialItems: [], initialFiles: picked }));
    runEffects();
    await flush();

    expect(openEditableImage).toHaveBeenCalledOnce();
    expect(railItems(render(props({ initialItems: [], initialFiles: picked })))).toHaveLength(1);
  });

  it("retries a pick whose decode went stale while the route was hidden", async () => {
    const decode = deferred<EditableImage>();
    openEditableImage.mockReturnValueOnce(decode.promise).mockResolvedValueOnce(image("retry"));
    const picked = [file("picked.jpg")];
    render(props({ initialItems: [], initialFiles: picked }));
    const cleanups = runEffects();
    expect(render(props({ initialItems: [], initialFiles: picked })).text).toContain("Opening photos…");

    cleanups.forEach((cleanup) => cleanup());
    decode.resolve(image("stale"));
    await flush();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:stale");

    render(props({ initialItems: [], initialFiles: picked }));
    runEffects();
    await flush();
    expect(openEditableImage).toHaveBeenCalledTimes(2);
    expect(railItems(render(props({ initialItems: [], initialFiles: picked })))).toEqual([
      expect.objectContaining({ kind: "new", image: image("retry") }),
    ]);
  });

  it("takes only what fits and says so", async () => {
    openEditableImage.mockResolvedValue(image("one"));
    render(props({ initialItems: [UPLOADED, NEW], initialFiles: [file("a.jpg"), file("b.jpg")] }));
    runEffects();
    await flush();
    const view = render(props({ initialItems: [UPLOADED, NEW], initialFiles: [] }));
    expect(openEditableImage).toHaveBeenCalledOnce();
    expect(view.rail!.note).toBe(tooManyPhotosNote(3));
  });

  it("notes a photo that could not be opened", async () => {
    openEditableImage.mockResolvedValue(null);
    (render(props()).rail!.onAddFiles as (files: File[]) => void)([file("broken.heic")]);
    await flush();
    const view = render(props());
    expect(view.rail!.note).toBe(UNREADABLE_PHOTO_ERROR);
    expect(railItems(view)).toHaveLength(2);
  });

  it("keeps the extra-photos note when a photo that fit could not be opened", async () => {
    openEditableImage.mockResolvedValue(null);
    (render(props()).rail!.onAddFiles as (files: File[]) => void)([
      file("broken.heic"),
      file("extra.jpg"),
    ]);
    await flush();
    const view = render(props());
    expect(view.rail!.note).toBe(`${tooManyPhotosNote(3)} ${UNREADABLE_PHOTO_ERROR}`);
  });
});

describe("PhotoStudioDialog: single mode", () => {
  it("starts on a picker, with no rail", () => {
    const view = render(props({ mode: "single", maxItems: 1, initialItems: [] }));
    expect(view.rail).toBeUndefined();
    expect(view.text).toContain("Your photo");
    expect(view.text).toContain("Choose a photo");
    expect(captured.dropzones.at(-1)!.multiple).toBe(false);
    expect(view.button("Save photo")!.disabled).toBe(true);
  });

  it("adds a dropped photo and removes it from the tool bar, freeing its source", async () => {
    openEditableImage.mockResolvedValue(image("single"));
    render(props({ mode: "single", maxItems: 1, initialItems: [] }));
    captured.dropzones.at(-1)!.onDrop([file("single.jpg")]);
    await flush();

    const view = render(props({ mode: "single", maxItems: 1, initialItems: [] }));
    expect(view.stage!.item).toMatchObject({ kind: "new", image: image("single") });
    (view.toolbar!.onRemove as () => void)();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:single");
    expect(render(props({ mode: "single", maxItems: 1, initialItems: [] })).stage).toBeUndefined();
  });

  it("shows a save message in single mode under the stage", async () => {
    const onSave = vi.fn(async () => "Choose a photo.");
    (render(props({ mode: "single", maxItems: 1, initialItems: [NEW], onSave })).button("Save photo")!.onClick as () => void)();
    await flush();
    expect(render(props({ mode: "single", maxItems: 1, initialItems: [NEW], onSave })).text).toContain("Choose a photo.");
  });
});
