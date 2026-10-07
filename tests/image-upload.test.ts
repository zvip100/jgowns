import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditableImage, PhotoEdits } from "@/lib/types";

type ImageUploadModule = typeof import("@/lib/image-upload");

const heicTo = vi.hoisted(() => vi.fn());
vi.mock("heic-to", () => ({ heicTo }));

/** Fresh per test: `supportsWebpEncoding` caches its answer at module level. */
let lib: ImageUploadModule;

beforeEach(async () => {
  vi.resetModules();
  lib = await import("@/lib/image-upload");
});

afterEach(() => {
  vi.unstubAllGlobals();
  heicTo.mockReset();
});

type ContextCall = [string, ...unknown[]];

type CanvasStub = {
  width: number;
  height: number;
  calls: ContextCall[];
  pixels: Uint8ClampedArray;
  context: Record<string, unknown> | null;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
};

/** Records every 2d call so the transform order can be asserted without a real canvas. */
function stubCanvas({
  blob = new Blob([new Uint8Array(64)]),
  webp = true,
  hasContext = true,
}: { blob?: Blob | null; webp?: boolean; hasContext?: boolean } = {}): CanvasStub {
  const canvas: CanvasStub = {
    width: 0,
    height: 0,
    calls: [],
    pixels: new Uint8ClampedArray([100, 150, 200, 255, 250, 10, 0, 128]),
    context: null,
    getContext: vi.fn(() => canvas.context),
    toBlob: vi.fn((callback: (result: Blob | null) => void) => callback(blob)),
    toDataURL: vi.fn((type?: string) =>
      type === "image/webp" && webp ? "data:image/webp;base64,x" : "data:image/png;base64,x",
    ),
  };
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      canvas.calls.push([name, ...args]);
    };
  if (hasContext) {
    canvas.context = {
      fillStyle: "",
      globalCompositeOperation: "source-over",
      setTransform: record("setTransform"),
      fillRect: record("fillRect"),
      scale: record("scale"),
      translate: record("translate"),
      rotate: record("rotate"),
      drawImage: record("drawImage"),
      getImageData: () => ({ data: canvas.pixels }),
      putImageData: record("putImageData"),
    };
  }
  return canvas;
}

type DomStubs = {
  canvases: CanvasStub[];
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
};

/** Every `createElement` hands out the next prepared canvas; images load or fail on demand. */
function stubDom(
  canvases: CanvasStub[],
  image: { width: number; height: number } | null = { width: 1200, height: 1600 },
): DomStubs {
  const queue = [...canvases];
  vi.stubGlobal("document", {
    createElement: vi.fn(() => queue.shift() ?? stubCanvas()),
  });
  const createObjectURL = vi.fn(() => "blob:source");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

  class ImageStub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = image?.width ?? 0;
    naturalHeight = image?.height ?? 0;
    width = image?.width ?? 0;
    height = image?.height ?? 0;
    set src(_value: string) {
      queueMicrotask(() => (image ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal("window", { Image: ImageStub });

  return { canvases, createObjectURL, revokeObjectURL };
}

function makeFile(name: string, type: string, bytes = 32): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** An ISO-BMFF header with a HEIC brand, under whatever name the seller gave it. */
function makeHeicFile(name: string): File {
  const data = new Uint8Array(1024);
  data.set([0, 0, 0, 24]);
  data.set(new TextEncoder().encode("ftypheic"), 4);
  return new File([data], name, { type: "image/jpeg" });
}

const IMAGE: EditableImage = { src: "blob:source", width: 1200, height: 1600, name: "gown.jpg" };

function cropEdits(overrides: Partial<PhotoEdits> = {}): PhotoEdits {
  return {
    framing: "crop",
    crop: { x: 100, y: 200, width: 600, height: 800 },
    rotation90: 0,
    tilt: 0,
    brightness: 0,
    zoom: 1,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}


describe("rotatedBoundingBox", () => {
  it("is the same box at 0 and 180 degrees and swaps at 90 and 270", () => {
    expect(lib.rotatedBoundingBox(300, 400, 0)).toEqual({ width: 300, height: 400 });
    const half = lib.rotatedBoundingBox(300, 400, 180);
    expect(half.width).toBeCloseTo(300);
    expect(half.height).toBeCloseTo(400);
    for (const degrees of [90, 270]) {
      const turned = lib.rotatedBoundingBox(300, 400, degrees);
      expect(turned.width).toBeCloseTo(400);
      expect(turned.height).toBeCloseTo(300);
    }
  });

  it("grows symmetrically for a tilt either way", () => {
    const left = lib.rotatedBoundingBox(300, 400, -15);
    const right = lib.rotatedBoundingBox(300, 400, 15);
    expect(left.width).toBeCloseTo(right.width);
    expect(left.width).toBeGreaterThan(300);
    expect(left.height).toBeGreaterThan(400);
  });
});

describe("minZoomToCover", () => {
  it("is the larger of the two axis ratios with no rotation", () => {
    expect(
      lib.minZoomToCover({ mediaWidth: 600, mediaHeight: 400, cropWidth: 300, cropHeight: 400, rotation: 0 }),
    ).toBeCloseTo(1);
    expect(
      lib.minZoomToCover({ mediaWidth: 300, mediaHeight: 800, cropWidth: 300, cropHeight: 400, rotation: 0 }),
    ).toBeCloseTo(1);
    expect(
      lib.minZoomToCover({ mediaWidth: 150, mediaHeight: 200, cropWidth: 300, cropHeight: 400, rotation: 0 }),
    ).toBeCloseTo(2);
  });

  it("compares the crop against the turned photo at 90 and 270", () => {
    for (const rotation of [90, 270]) {
      // A landscape photo turned upright exactly covers a portrait window.
      expect(
        lib.minZoomToCover({ mediaWidth: 400, mediaHeight: 300, cropWidth: 300, cropHeight: 400, rotation }),
      ).toBeCloseTo(1);
    }
  });

  it("needs more zoom for a tilt, the same either way", () => {
    const base = { mediaWidth: 300, mediaHeight: 400, cropWidth: 300, cropHeight: 400 };
    const plus = lib.minZoomToCover({ ...base, rotation: 15 });
    expect(plus).toBeGreaterThan(1);
    expect(lib.minZoomToCover({ ...base, rotation: -15 })).toBeCloseTo(plus);
    expect(lib.minZoomToCover({ ...base, rotation: 105 })).toBeGreaterThan(1);
  });
});

describe("fitZoom", () => {
  it("fits a very tall photo by its height and a landscape one by its width", () => {
    expect(
      lib.fitZoom({ mediaWidth: 156, mediaHeight: 400, cropWidth: 300, cropHeight: 400, rotation90: 0 }),
    ).toBeCloseTo(1);
    expect(
      lib.fitZoom({ mediaWidth: 600, mediaHeight: 400, cropWidth: 300, cropHeight: 400, rotation90: 0 }),
    ).toBeCloseTo(0.5);
  });

  it("swaps the photo's sides at 90 and 270, not at 180", () => {
    const base = { mediaWidth: 600, mediaHeight: 400, cropWidth: 300, cropHeight: 400 };
    expect(lib.fitZoom({ ...base, rotation90: 180 })).toBeCloseTo(0.5);
    expect(lib.fitZoom({ ...base, rotation90: 90 })).toBeCloseTo(2 / 3);
    expect(lib.fitZoom({ ...base, rotation90: 270 })).toBeCloseTo(2 / 3);
  });
});

describe("outputSize", () => {
  it("is exact 3:4 even when the crop is not divisible by 3 or 4", () => {
    const size = lib.outputSize({ x: 0, y: 0, width: 1001, height: 1335 });
    expect(size.width * 4).toBe(size.height * 3);
    expect(size).toEqual({ width: 999, height: 1332 });
  });

  it("caps at 1800x2400", () => {
    expect(lib.outputSize({ x: 0, y: 0, width: 4500, height: 6000 })).toEqual({ width: 1800, height: 2400 });
  });

  it("never upscales a small crop", () => {
    expect(lib.outputSize({ x: 0, y: 0, width: 300, height: 400 })).toEqual({ width: 300, height: 400 });
  });

  it("follows the tighter side of a crop that is not quite 3:4", () => {
    expect(lib.outputSize({ x: 0, y: 0, width: 301, height: 399 })).toEqual({ width: 297, height: 396 });
  });
});

describe("serverFramingSize", () => {
  it("caps the long edge at 2400", () => {
    expect(lib.serverFramingSize(4000, 3000, 0)).toEqual({ width: 2400, height: 1800 });
  });

  it("swaps dimensions for a quarter turn", () => {
    expect(lib.serverFramingSize(4000, 3000, 90)).toEqual({ width: 1800, height: 2400 });
    expect(lib.serverFramingSize(4000, 3000, 270)).toEqual({ width: 1800, height: 2400 });
    expect(lib.serverFramingSize(4000, 3000, 180)).toEqual({ width: 2400, height: 1800 });
  });

  it("never upscales", () => {
    expect(lib.serverFramingSize(780, 2000, 0)).toEqual({ width: 780, height: 2000 });
  });
});

describe("applyBrightness", () => {
  it("leaves the pixels alone at 0", () => {
    const data = new Uint8ClampedArray([10, 20, 30, 40]);
    lib.applyBrightness(data, 0);
    expect([...data]).toEqual([10, 20, 30, 40]);
  });

  it("scales color channels, clamps at 255, and never touches alpha", () => {
    const data = new Uint8ClampedArray([100, 200, 250, 128]);
    lib.applyBrightness(data, 20);
    expect([...data]).toEqual([120, 240, 255, 128]);
  });

  it("darkens for a negative value", () => {
    const data = new Uint8ClampedArray([100, 200, 50, 255]);
    lib.applyBrightness(data, -30);
    expect([...data]).toEqual([70, 140, 35, 255]);
  });
});

describe("supportsWebpEncoding", () => {
  it("tests one 1x1 canvas and caches the answer", () => {
    const canvas = stubCanvas();
    const createElement = vi.fn(() => canvas);
    vi.stubGlobal("document", { createElement });

    expect(lib.supportsWebpEncoding()).toBe(true);
    expect(lib.supportsWebpEncoding()).toBe(true);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect([canvas.width, canvas.height]).toEqual([1, 1]);
  });

  it("is false where the canvas falls back to PNG, as Safari's does", () => {
    vi.stubGlobal("document", { createElement: () => stubCanvas({ webp: false }) });
    expect(lib.supportsWebpEncoding()).toBe(false);
  });

  it("is false when the test itself throws", () => {
    vi.stubGlobal("document", {
      createElement: () => {
        throw new Error("no canvas");
      },
    });
    expect(lib.supportsWebpEncoding()).toBe(false);
  });
});

describe("openEditableImage", () => {
  it("opens a JPEG as an object URL measured from the decoded image", async () => {
    stubDom([], { width: 3000, height: 4000 });

    await expect(lib.openEditableImage(makeFile("gown.jpg", "image/jpeg"))).resolves.toEqual({
      src: "blob:source",
      width: 3000,
      height: 4000,
      name: "gown.jpg",
    });
    expect(heicTo).not.toHaveBeenCalled();
  });

  it("resolves null and revokes the URL when the browser cannot read it", async () => {
    const dom = stubDom([], null);

    await expect(lib.openEditableImage(makeFile("gown.tif", "image/tiff"))).resolves.toBeNull();
    expect(dom.revokeObjectURL).toHaveBeenCalledWith("blob:source");
  });

  it("converts a HEIC renamed to .jpg to one JPEG, capped at 12 megapixels", async () => {
    const canvas = stubCanvas();
    const close = vi.fn();
    const dom = stubDom([canvas]);
    heicTo.mockResolvedValue({ width: 4000, height: 4000, close });

    const image = await lib.openEditableImage(makeHeicFile("gown.jpg"));

    expect(heicTo).toHaveBeenCalledWith({ blob: expect.any(File), type: "bitmap" });
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
    expect(image).toEqual({ src: "blob:source", width: 3464, height: 3464, name: "gown.jpg" });
    expect(dom.createObjectURL).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    // The canvas is released once its blob exists.
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it("caps a HEIC by its 3600px long edge when that is the tighter limit", async () => {
    const canvas = stubCanvas();
    stubDom([canvas]);
    heicTo.mockResolvedValue({ width: 6000, height: 8000, close: vi.fn() });

    const image = await lib.openEditableImage(makeHeicFile("tall.heic"));

    expect(image?.height).toBe(3600);
    expect(image?.width).toBe(2700);
  });

  it("resolves null when the HEIC decoder fails", async () => {
    stubDom([]);
    heicTo.mockRejectedValue(new Error("decode failed"));

    await expect(lib.openEditableImage(makeHeicFile("gown.heic"))).resolves.toBeNull();
  });

  it("closes the bitmap when the HEIC cannot be re-encoded", async () => {
    const close = vi.fn();
    stubDom([stubCanvas({ blob: null })]);
    heicTo.mockResolvedValue({ width: 1000, height: 800, close });

    await expect(lib.openEditableImage(makeHeicFile("gown.heic"))).resolves.toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the bitmap when the canvas has no 2d context", async () => {
    const close = vi.fn();
    stubDom([stubCanvas({ hasContext: false })]);
    heicTo.mockResolvedValue({ width: 1000, height: 800, close });

    await expect(lib.openEditableImage(makeHeicFile("gown.heic"))).resolves.toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("exportEditedImage", () => {
  /** The first canvas is the export itself, the second the one-time WebP test. */
  function exportWith(edits: PhotoEdits, options: { webp?: boolean } = {}) {
    const output = stubCanvas();
    stubDom([output, stubCanvas({ webp: options.webp ?? true })]);
    return { output, result: lib.exportEditedImage(IMAGE, edits) };
  }

  it("draws a crop straight onto an exact 3:4 output, in transform order", async () => {
    const { output, result } = exportWith(cropEdits());
    const file = await result;

    expect([output.width, output.height]).toEqual([0, 0]);
    expect(output.calls.map(([name]) => name)).toEqual([
      "scale",
      "translate",
      "translate",
      "rotate",
      "drawImage",
      "setTransform",
      "fillRect",
    ]);
    expect(output.calls[0]).toEqual(["scale", 1, 1]);
    expect(output.calls[1]).toEqual(["translate", -100, -200]);
    expect(output.calls[2]).toEqual(["translate", 600, 800]);
    expect(output.calls[4]).toEqual(["drawImage", expect.anything(), -600, -800, 1200, 1600]);
    expect(output.calls[6]).toEqual(["fillRect", 0, 0, 600, 800]);
    expect(file?.name).toBe("gown.webp");
    expect(file?.type).toBe("image/webp");
  });

  it("puts the card color behind a crop, so an exposed corner exports as cream", async () => {
    const { output, result } = exportWith(cropEdits());
    await result;
    expect(output.context?.fillStyle).toBe("#efe7dc");
    expect(output.context?.globalCompositeOperation).toBe("destination-over");
    expect(output.calls.at(-2)).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
  });

  it.each([
    [90, 1600, 1200],
    [180, 1200, 1600],
    [270, 1600, 1200],
  ] as const)("rotates around the turned box's center at %i degrees", async (rotation90, boxWidth, boxHeight) => {
    const { output, result } = exportWith(cropEdits({ rotation90 }));
    await result;

    const [, x, y] = output.calls[2];
    expect(x).toBeCloseTo(boxWidth / 2);
    expect(y).toBeCloseTo(boxHeight / 2);
    expect(output.calls[3][1]).toBeCloseTo((rotation90 * Math.PI) / 180);
  });

  it("adds a straighten tilt to the rotation", async () => {
    const { output, result } = exportWith(cropEdits({ rotation90: 90, tilt: -7.5 }));
    await result;
    expect(output.calls[3][1]).toBeCloseTo((82.5 * Math.PI) / 180);
  });

  it("scales a large crop down to the 1800x2400 cap", async () => {
    const { output, result } = exportWith(
      cropEdits({ crop: { x: 0, y: 0, width: 3000, height: 4000 } }),
    );
    await result;
    expect(output.calls[0]).toEqual(["scale", 0.6, 0.6]);
    expect(output.calls.at(-1)).toEqual(["fillRect", 0, 0, 1800, 2400]);
  });

  it("sends the whole photo uncropped for server framing, turned by quarter turns", async () => {
    const { output, result } = exportWith(
      cropEdits({ framing: "server", crop: null, rotation90: 90 }),
    );
    await result;

    expect(output.calls.map(([name]) => name)).toEqual(["translate", "rotate", "drawImage"]);
    expect(output.calls[0]).toEqual(["translate", 800, 600]);
    expect(output.calls[2]).toEqual(["drawImage", expect.anything(), -600, -800, 1200, 1600]);
  });

  it("brightens the exported pixels only when asked, before the cream goes behind", async () => {
    const { output, result } = exportWith(cropEdits({ brightness: 10 }));
    await result;

    expect(output.calls.slice(-3).map(([name]) => name)).toEqual(["putImageData", "setTransform", "fillRect"]);
    expect([...output.pixels]).toEqual([110, 165, 220, 255, 255, 11, 0, 128]);

    const plain = exportWith(cropEdits());
    await plain.result;
    expect(plain.output.calls.some(([name]) => name === "putImageData")).toBe(false);
  });

  it("encodes once as JPEG where WebP encoding is missing", async () => {
    const { output, result } = exportWith(cropEdits(), { webp: false });
    const file = await result;

    expect(output.toBlob).toHaveBeenCalledOnce();
    expect(output.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
    expect(file?.name).toBe("gown.jpg");
    expect(file?.type).toBe("image/jpeg");
  });

  it("puts cream behind a server-framed JPEG, which would flatten transparency to black", async () => {
    const { output, result } = exportWith(
      cropEdits({ framing: "server", crop: null }),
      { webp: false },
    );
    await result;

    expect(output.calls.slice(-2).map(([name]) => name)).toEqual(["setTransform", "fillRect"]);
    expect(output.context?.globalCompositeOperation).toBe("destination-over");
  });

  it("resolves null when the source no longer loads", async () => {
    stubDom([], null);
    await expect(lib.exportEditedImage(IMAGE, cropEdits())).resolves.toBeNull();
  });

  it("resolves null when encoding fails, and still releases the canvas", async () => {
    const output = stubCanvas({ blob: null });
    stubDom([output, stubCanvas()]);

    await expect(lib.exportEditedImage(IMAGE, cropEdits())).resolves.toBeNull();
    expect([output.width, output.height]).toEqual([0, 0]);
  });

  it("resolves null without a 2d context", async () => {
    stubDom([stubCanvas({ hasContext: false })]);
    await expect(lib.exportEditedImage(IMAGE, cropEdits())).resolves.toBeNull();
  });
});

describe("dataUrlToFile", () => {
  it("names the file by the source extension of the decoded blob", async () => {
    const file = await lib.dataUrlToFile("data:image/webp;base64,UklGRg==", "gown.jpg");

    expect(file.name).toBe("gown.webp");
    expect(file.type).toBe("image/webp");
  });

  it("falls back to jpg for a type it does not map", async () => {
    const file = await lib.dataUrlToFile("data:image/gif;base64,R0lGOD==", "");

    expect(file.name).toBe("photo.jpg");
  });
});

describe("generateBlurDataUrl", () => {
  it("draws a 32px-wide placeholder from a file", async () => {
    const canvas = stubCanvas();
    canvas.toDataURL = vi.fn(() => "data:image/jpeg;base64,blur");
    stubDom([canvas], { width: 40, height: 20 });

    await expect(
      lib.generateBlurDataUrl(makeFile("gown.jpg", "image/jpeg")),
    ).resolves.toBe("data:image/jpeg;base64,blur");
    expect([canvas.width, canvas.height]).toEqual([32, 16]);
  });

  it("resolves null when the image fails to load", async () => {
    stubDom([], null);

    await expect(lib.generateBlurDataUrl("data:image/webp;base64,x")).resolves.toBeNull();
  });
});
