import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dataUrlToFile,
  downscaleImageFile,
  generateBlurDataUrl,
} from "@/lib/image-upload";

const LARGE_BYTES = 3 * 1024 * 1024;

function makeFile(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

type CanvasStub = {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
};

function stubCanvas(blob: Blob | null): CanvasStub {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toBlob: vi.fn((callback: (result: Blob | null) => void) => callback(blob)),
    toDataURL: vi.fn(() => "data:image/jpeg;base64,blur"),
  };
}

/** Both helpers reach for a canvas and one decoder; nothing else here is real. */
function stubDom(canvas: CanvasStub) {
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downscaleImageFile", () => {
  it("leaves a file at or under the threshold untouched", async () => {
    const file = makeFile("small.jpg", "image/jpeg", 1024);
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it("leaves the file untouched where the browser cannot decode it", async () => {
    const file = makeFile("gown.jpg", "image/jpeg", LARGE_BYTES);
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it("scales the long edge to 2400 and re-encodes as WebP", async () => {
    const file = makeFile("gown.jpg", "image/jpeg", LARGE_BYTES);
    const canvas = stubCanvas(new Blob([new Uint8Array(900_000)]));
    const close = vi.fn();
    stubDom(canvas);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close })),
    );

    const result = await downscaleImageFile(file);

    expect(result).not.toBe(file);
    expect(result.name).toBe("gown.webp");
    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(900_000);
    expect([canvas.width, canvas.height]).toEqual([2400, 1800]);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      0.9,
    );
    expect(close).toHaveBeenCalled();
  });

  it("re-encodes without upscaling an image already under the cap", async () => {
    const file = makeFile("gown.png", "image/png", LARGE_BYTES);
    const canvas = stubCanvas(new Blob([new Uint8Array(500_000)]));
    stubDom(canvas);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })),
    );

    await downscaleImageFile(file);

    expect([canvas.width, canvas.height]).toEqual([1000, 800]);
  });

  it("keeps the original when the re-encode is not smaller", async () => {
    const file = makeFile("gown.jpg", "image/jpeg", LARGE_BYTES);
    stubDom(stubCanvas(new Blob([new Uint8Array(LARGE_BYTES)])));
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })),
    );

    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it("keeps the original when the canvas has no 2d context", async () => {
    const file = makeFile("gown.jpg", "image/jpeg", LARGE_BYTES);
    const canvas = stubCanvas(null);
    canvas.getContext = vi.fn(() => null);
    stubDom(canvas);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })),
    );

    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });

  it("keeps the original when decoding throws", async () => {
    const file = makeFile("gown.heic", "image/heic", LARGE_BYTES);
    stubDom(stubCanvas(null));
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("unsupported image type");
      }),
    );

    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });
});

describe("dataUrlToFile", () => {
  it("names the file by the source extension of the decoded blob", async () => {
    const file = await dataUrlToFile(
      "data:image/webp;base64,UklGRg==",
      "gown.jpg",
    );

    expect(file.name).toBe("gown.webp");
    expect(file.type).toBe("image/webp");
  });

  it("falls back to jpg for a type it does not map", async () => {
    const file = await dataUrlToFile("data:image/gif;base64,R0lGOD==", "");

    expect(file.name).toBe("photo.jpg");
  });
});

describe("generateBlurDataUrl", () => {
  function stubImage(shouldLoad: boolean) {
    class ImageStub {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 40;
      height = 20;
      set src(_value: string) {
        queueMicrotask(() =>
          shouldLoad ? this.onload?.() : this.onerror?.(),
        );
      }
    }
    vi.stubGlobal("window", { Image: ImageStub });
  }

  it("draws a 32px-wide placeholder from a file", async () => {
    const canvas = stubCanvas(null);
    stubDom(canvas);
    stubImage(true);

    await expect(
      generateBlurDataUrl(makeFile("gown.jpg", "image/jpeg", 32)),
    ).resolves.toBe("data:image/jpeg;base64,blur");
    expect([canvas.width, canvas.height]).toEqual([32, 16]);
  });

  it("resolves null when the image fails to load", async () => {
    stubDom(stubCanvas(null));
    stubImage(false);

    await expect(generateBlurDataUrl("data:image/webp;base64,x")).resolves.toBeNull();
  });
});
