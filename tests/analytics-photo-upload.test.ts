import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageSlotState } from "@/lib/types";

const { hookState, mockCaptureEvent, mockOptimizeListingPhoto } = vi.hoisted(
  () => ({
    hookState: {
      refCallCount: 0,
      refs: [] as { current: unknown }[],
      slots: [] as ImageSlotState[],
    },
    mockCaptureEvent: vi.fn(),
    mockOptimizeListingPhoto: vi.fn(),
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
      const value =
        typeof initial === "function" ? (initial as () => State)() : initial;
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
}));

import { useListingImageSlots } from "@/hooks/useListingImageSlots";

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], "gown.jpg", { type: "image/jpeg" });
}

function mountHook() {
  hookState.refCallCount = 0;
  hookState.refs = [];
  return useListingImageSlots();
}

beforeEach(() => {
  mockCaptureEvent.mockReset();
  mockOptimizeListingPhoto.mockReset();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:preview"),
    revokeObjectURL: vi.fn(),
  });
});

describe("photo upload events", () => {
  it("fires started then succeeded for one optimized photo", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({
      dataUrl: "data:image/webp;base64,ok",
      blurDataUrl: "data:image/jpeg;base64,blur",
    });

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(2048));

    expect(mockCaptureEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureEvent.mock.calls[0]).toEqual([
      "photo_upload_started",
      { file_count: 1, total_size: 2048 },
    ]);

    const [succeededName, succeededProperties] = mockCaptureEvent.mock.calls[1];
    expect(succeededName).toBe("photo_upload_succeeded");
    expect(succeededProperties.file_count).toBe(1);
    expect(typeof succeededProperties.duration_ms).toBe("number");
  });

  it("fires started then failed, carrying the reason", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({
      error: "Please upload a valid image file.",
    });

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(1024));

    expect(mockCaptureEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureEvent.mock.calls[1]).toEqual([
      "photo_upload_failed",
      {
        reason: "Please upload a valid image file.",
        file_count: 1,
        total_size: 1024,
      },
    ]);
  });

  it("truncates a long failure reason rather than sending it whole", async () => {
    mockOptimizeListingPhoto.mockResolvedValue({ error: "x".repeat(400) });

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(1024));

    expect(mockCaptureEvent.mock.calls[1][1].reason).toHaveLength(120);
  });

  // Exactly one terminal event per attempt, even when the slot moved on.
  it("still terminates an attempt whose slot was superseded", async () => {
    mockOptimizeListingPhoto.mockImplementation(async () => {
      hookState.refs[0].current = [];
      return { dataUrl: "data:image/webp;base64,ok" };
    });

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(1024));

    const names = mockCaptureEvent.mock.calls.map((call) => call[0]);
    expect(names).toEqual(["photo_upload_started", "photo_upload_succeeded"]);
  });

  // The action always returns, so this is the request itself failing. Without
  // a terminal event the attempt vanishes and the slot spins forever.
  it("terminates an attempt whose request never completed", async () => {
    mockOptimizeListingPhoto.mockRejectedValue(new TypeError("Failed to fetch"));

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(4096));

    expect(mockCaptureEvent.mock.calls.map((call) => call[0])).toEqual([
      "photo_upload_started",
      "photo_upload_failed",
    ]);
    expect(mockCaptureEvent.mock.calls[1][1].reason).toBe("Failed to fetch");

    const slot = hookState.slots[0];
    expect(slot.optimizing).toBe(false);
    expect(slot.optimizeError).toContain("Failed to fetch");
  });

  it("names a rejection that carried no message", async () => {
    mockOptimizeListingPhoto.mockRejectedValue("boom");

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(1024));

    expect(mockCaptureEvent.mock.calls[1][1].reason).toBe("The upload failed.");
  });

  it("counts a retry as a new attempt", async () => {
    mockOptimizeListingPhoto
      .mockResolvedValueOnce({ error: "boom" })
      .mockResolvedValueOnce({ dataUrl: "data:image/webp;base64,ok" });

    const { onFileSelected } = mountHook();
    await onFileSelected(0, makeFile(1024));
    await onFileSelected(0, makeFile(1024));

    const names = mockCaptureEvent.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      "photo_upload_started",
      "photo_upload_failed",
      "photo_upload_started",
      "photo_upload_succeeded",
    ]);
  });
});
