import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EditableImage, ImageSlotState, PhotoEdits, PhotoStudioItem } from "@/lib/types";

const { hookState, mockCaptureEvent, mockOptimizeListingPhoto, mockExport } = vi.hoisted(
  () => ({
    hookState: {
      refCallCount: 0,
      refs: [] as { current: unknown }[],
      slots: [] as ImageSlotState[],
      isRerender: false,
    },
    mockCaptureEvent: vi.fn(),
    mockOptimizeListingPhoto: vi.fn(),
    mockExport: vi.fn(),
  }),
);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: (): void => {},
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refCallCount++;
      if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
      return hookState.refs[index] as { current: Value };
    },
    useState: <State>(
      initial: State | (() => State),
    ): [State, (next: unknown) => void] => {
      // A re-render reads the state back instead of re-running the initializer.
      const value = hookState.isRerender
        ? (hookState.slots as State)
        : typeof initial === "function"
          ? (initial as () => State)()
          : initial;
      hookState.slots = value as ImageSlotState[];
      // Applied for real, and mirrored into the slots ref the hook reads back:
      // a no-op setter leaves every attempt looking stale, so nothing past the
      // staleness guard (the slot's own cleanup) would ever run.
      return [
        value,
        (next: unknown) => {
          hookState.slots =
            typeof next === "function"
              ? (next as (prev: ImageSlotState[]) => ImageSlotState[])(
                  hookState.slots,
                )
              : (next as ImageSlotState[]);
          if (hookState.refs[0]) hookState.refs[0].current = hookState.slots;
        },
      ];
    },
  };
});

vi.mock("@/lib/actions/images", () => ({
  optimizeListingPhoto: mockOptimizeListingPhoto,
}));
vi.mock("@/lib/analytics/client", () => ({ captureEvent: mockCaptureEvent }));
vi.mock("@/lib/image-upload", () => ({
  generateBlurDataUrl: vi.fn().mockResolvedValue(null),
  dataUrlToFile: vi.fn(),
  // The export is a browser canvas round trip; the attempt it starts is what
  // this suite measures.
  exportEditedImage: mockExport,
  UNREADABLE_PHOTO_ERROR: "This photo can't be opened. Try a JPG or PNG.",
}));

import { slotsToStudioItems, useListingImageSlots } from "@/hooks/useListingImageSlots";

const EDITS: PhotoEdits = {
  framing: "crop",
  crop: { x: 0, y: 0, width: 1200, height: 1600 },
  rotation90: 0,
  tilt: 0,
  brightness: 0,
  zoom: 1,
  position: { x: 0, y: 0 },
};

function image(name: string): EditableImage {
  return { src: `blob:${name}`, width: 1200, height: 1600, name: `${name}.jpg` };
}

function newItem(id: string, edits: PhotoEdits = EDITS): PhotoStudioItem {
  return { id, kind: "new", image: image(id), edits };
}

function exported(size: number): File {
  return new File([new Uint8Array(size)], "gown.webp", { type: "image/webp" });
}

function mountHook(initialUrls: string[] = []) {
  hookState.refCallCount = 0;
  hookState.refs = [];
  hookState.isRerender = false;
  return useListingImageSlots({ initialUrls });
}

function rerenderHook() {
  hookState.refCallCount = 0;
  hookState.isRerender = true;
  return useListingImageSlots();
}

/** Lets every queued export and optimize step run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function eventNames(): string[] {
  return mockCaptureEvent.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  mockCaptureEvent.mockReset();
  mockOptimizeListingPhoto.mockReset();
  mockExport.mockReset();
  mockExport.mockResolvedValue(exported(2048));
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:preview"),
    revokeObjectURL: vi.fn(),
  });
});

describe("photo upload events", () => {
  it("fires started then succeeded for one new photo, carrying the export's size", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({
      dataUrl: "data:image/avif;base64,ok",
      blurDataUrl: "data:image/jpeg;base64,blur",
    });

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(mockExport).toHaveBeenCalledExactlyOnceWith(image("a"), EDITS);
    expect(mockCaptureEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureEvent.mock.calls[0]).toEqual([
      "photo_upload_started",
      { file_count: 1, total_size: 2048 },
    ]);
    const [succeededName, succeededProperties] = mockCaptureEvent.mock.calls[1];
    expect(succeededName).toBe("photo_upload_succeeded");
    expect(succeededProperties.file_count).toBe(1);
    expect(typeof succeededProperties.duration_ms).toBe("number");

    const slot = hookState.slots[0];
    expect(slot.optimizing).toBe(false);
    expect(slot.preview).toBe("data:image/avif;base64,ok");
    expect(slot.version).toBe(1);
  });

  it("fires one pair per new photo, and none for an uploaded one", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ dataUrl: "data:image/avif;base64,ok" });

    const hook = mountHook(["https://cdn.example.com/u.avif"]);
    hook.applyStudio([
      { id: "slot-0", kind: "uploaded", url: "https://cdn.example.com/u.avif" },
      newItem("a"),
      newItem("b"),
    ]);
    await settle();

    expect(mockExport).toHaveBeenCalledTimes(2);
    expect(eventNames().filter((name) => name === "photo_upload_started")).toHaveLength(2);
    expect(eventNames().filter((name) => name === "photo_upload_succeeded")).toHaveLength(2);
    expect(hookState.slots[0].existingUrl).toBe("https://cdn.example.com/u.avif");
  });

  it("fires started then failed, carrying the reason, and keeps the export to upload", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({
      error: "Please upload a valid image file.",
    });

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(mockCaptureEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureEvent.mock.calls[1]).toEqual([
      "photo_upload_failed",
      {
        reason: "Please upload a valid image file.",
        file_count: 1,
        total_size: 2048,
      },
    ]);
    expect(hookState.slots[0].imageFile?.size).toBe(2048);
    expect(hookState.slots[0].optimizeError).toContain("Please upload a valid image file.");
  });

  it("truncates a long failure reason rather than sending it whole", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ error: "x".repeat(400) });

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(mockCaptureEvent.mock.calls[1][1].reason).toHaveLength(120);
  });

  it("fails a photo whose export failed without uploading it", async () => {
    mockExport.mockResolvedValueOnce(null);

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(mockOptimizeListingPhoto).not.toHaveBeenCalled();
    expect(mockCaptureEvent.mock.calls).toEqual([
      ["photo_upload_started", { file_count: 1, total_size: 0 }],
      ["photo_upload_failed", { reason: "unreadable_image", file_count: 1, total_size: 0 }],
    ]);
    expect(hookState.slots[0].source).toBeNull();
    expect(hookState.slots[0].optimizeError).toBe("This photo can't be opened. Try a JPG or PNG.");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a");
  });

  // Exactly one terminal event per attempt, even when a re-edit replaced it.
  it("still terminates an attempt whose slot was re-edited, and drops its result", async () => {
    let finishFirst: (value: unknown) => void = () => {};
    mockOptimizeListingPhoto
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce({ dataUrl: "data:image/avif;base64,second" });

    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    await settle();
    hook.applyStudio([newItem("a", { ...EDITS, brightness: 10 })]);
    await settle();
    finishFirst({ dataUrl: "data:image/avif;base64,first" });
    await settle();

    expect(eventNames()).toEqual([
      "photo_upload_started",
      "photo_upload_started",
      "photo_upload_succeeded",
      "photo_upload_succeeded",
    ]);
    expect(hookState.slots[0].version).toBe(2);
    expect(hookState.slots[0].preview).toBe("data:image/avif;base64,second");
  });

  it("drops the result of a photo removed while it optimized", async () => {
    let finish: (value: unknown) => void = () => {};
    mockOptimizeListingPhoto.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    await settle();
    hook.applyStudio([]);
    finish({ dataUrl: "data:image/avif;base64,late" });
    await settle();

    expect(eventNames()).toEqual(["photo_upload_started", "photo_upload_succeeded"]);
    expect(hookState.slots.every((slot) => slot.preview === null)).toBe(true);
  });

  it("fires nothing for an export superseded or removed before it could upload", async () => {
    let finishExport: (file: File) => void = () => {};
    mockExport.mockReturnValueOnce(new Promise((resolve) => (finishExport = resolve)));

    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    hook.applyStudio([]);
    finishExport(exported(2048));
    await settle();

    expect(mockCaptureEvent).not.toHaveBeenCalled();
    expect(mockOptimizeListingPhoto).not.toHaveBeenCalled();
  });

  // The action always returns, so this is the request itself failing. Without
  // a terminal event the attempt vanishes and the slot spins forever.
  it("terminates an attempt whose request never completed", async () => {
    mockOptimizeListingPhoto.mockRejectedValue(new TypeError("Failed to fetch"));

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(eventNames()).toEqual(["photo_upload_started", "photo_upload_failed"]);
    expect(mockCaptureEvent.mock.calls[1][1].reason).toBe("Failed to fetch");

    const slot = hookState.slots[0];
    expect(slot.optimizing).toBe(false);
    expect(slot.optimizeError).toContain("Failed to fetch");
  });

  it("names a rejection that carried no message", async () => {
    mockOptimizeListingPhoto.mockRejectedValue("boom");

    mountHook().applyStudio([newItem("a")]);
    await settle();

    expect(mockCaptureEvent.mock.calls[1][1].reason).toBe("The upload failed.");
  });

  it("exports nothing and fires nothing for an untouched photo or a pure reorder", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ dataUrl: "data:image/avif;base64,ok" });

    const hook = mountHook();
    hook.applyStudio([newItem("a"), newItem("b")]);
    await settle();
    mockCaptureEvent.mockClear();
    mockExport.mockClear();

    const saved = slotsToStudioItems(hookState.slots);
    hook.applyStudio([saved[1], saved[0]]);
    await settle();

    expect(mockExport).not.toHaveBeenCalled();
    expect(mockCaptureEvent).not.toHaveBeenCalled();
    expect(hookState.slots.slice(0, 2).map((slot) => slot.id)).toEqual(["b", "a"]);
    expect(hookState.slots.map((slot) => slot.version)).toEqual([1, 1, 0]);
  });

  it("counts a re-edit after a failure as a new attempt", async () => {
    mockOptimizeListingPhoto
      .mockResolvedValueOnce({ error: "boom" })
      .mockResolvedValueOnce({ dataUrl: "data:image/avif;base64,ok" });

    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    await settle();
    hook.applyStudio([newItem("a", { ...EDITS, tilt: 2 })]);
    await settle();

    expect(eventNames()).toEqual([
      "photo_upload_started",
      "photo_upload_failed",
      "photo_upload_started",
      "photo_upload_succeeded",
    ]);
  });
});

describe("slotsToStudioItems", () => {
  it("lists filled slots in order, uploaded or new, and skips empty ones", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ dataUrl: "data:image/avif;base64,ok" });
    const hook = mountHook(["https://cdn.example.com/u.avif"]);
    hook.applyStudio([
      { id: "slot-0", kind: "uploaded", url: "https://cdn.example.com/u.avif" },
      newItem("a"),
    ]);
    await settle();

    expect(slotsToStudioItems(hookState.slots)).toEqual([
      { id: "slot-0", kind: "uploaded", url: "https://cdn.example.com/u.avif" },
      newItem("a"),
    ]);
  });
});

describe("onClear and resolveUploadFile", () => {
  it("revokes a cleared photo's object URLs and pads the slots back to three", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ error: "boom" });
    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    await settle();

    rerenderHook().onClear(0);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a");
    expect(hookState.slots).toHaveLength(3);
    expect(hookState.slots.every((slot) => slot.source === null)).toBe(true);
  });

  it("clears the current slot even from a handler bound before the last save", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ error: "boom" });
    const staleHook = mountHook();
    staleHook.applyStudio([newItem("a")]);
    await settle();

    staleHook.onClear(0);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a");
    expect(hookState.slots.every((slot) => slot.source === null)).toBe(true);
  });

  it("ignores an index with no slot", () => {
    const hook = mountHook();
    const before = hookState.slots;

    hook.onClear(5);

    expect(hookState.slots).toBe(before);
  });

  it("starts no upload for a photo cleared while its export was in flight", async () => {
    let finishExport: (file: File) => void = () => {};
    mockExport.mockReturnValue(new Promise<File>((resolve) => (finishExport = resolve)));
    const hook = mountHook();
    hook.applyStudio([newItem("a")]);

    hook.onClear(0);
    finishExport(exported(2048));
    await settle();

    expect(mockOptimizeListingPhoto).not.toHaveBeenCalled();
    expect(eventNames()).toEqual([]);
  });

  it("uploads the export itself when optimizing failed", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ error: "boom" });
    const hook = mountHook();
    hook.applyStudio([newItem("a")]);
    await settle();

    await expect(hook.resolveUploadFile(hookState.slots[0])).resolves.toBe(
      hookState.slots[0].imageFile,
    );
  });
});
