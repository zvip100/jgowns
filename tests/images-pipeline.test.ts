import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSharp, mockSharpInstance, mockFaceDetection } = vi.hoisted(() => {
  const mockFaceDetection = vi.fn();
  const mockSharpInstance = {
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    extract: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(),
  };
  const mockSharp = vi.fn().mockReturnValue(mockSharpInstance);
  return { mockSharp, mockSharpInstance, mockFaceDetection };
});

vi.mock("sharp", () => ({ default: mockSharp }));
vi.mock("@google-cloud/vision", () => ({
  default: {
    // Regular function, not an arrow, so `new` works.
    ImageAnnotatorClient: vi.fn().mockImplementation(function () {
      return { faceDetection: mockFaceDetection };
    }),
  },
}));

process.env.GOOGLE_CLOUD_PROJECT_ID = "test-project";
process.env.GOOGLE_CLOUD_CLIENT_EMAIL = "test@test.iam.gserviceaccount.com";
process.env.GOOGLE_CLOUD_PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

import {
  blurPlaceholderDataUrl,
  processListingImage,
} from "@/lib/images/pipeline";

import { MAX_BLUR_DATA_URL_LENGTH } from "@/lib/types";

function faceAt(x: number, y: number, size = 100) {
  return {
    fdBoundingPoly: {
      vertices: [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size },
      ],
    },
  };
}

describe("processListingImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharp.mockReturnValue(mockSharpInstance);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from("processed"));
    mockFaceDetection.mockResolvedValue([
      { faceAnnotations: [], error: null },
    ]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns the encoded buffer and reports a successful detection", async () => {
    const result = await processListingImage(Buffer.from("input"));

    expect(result.webp).toEqual(Buffer.from("processed"));
    expect(result.visionOk).toBe(true);
    expect(result.facesDetected).toBe(0);
  });

  it("auto-orients the input so EXIF rotation is applied before the crop", async () => {
    await processListingImage(Buffer.from("input"));

    expect(mockSharp).toHaveBeenCalledWith(Buffer.from("input"), {
      autoOrient: true,
    });
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(1200, 1600, {
      fit: "cover",
      position: "attention",
    });
  });

  it("blurs and counts each detected face", async () => {
    mockFaceDetection.mockResolvedValue([
      { faceAnnotations: [faceAt(10, 20), faceAt(300, 400)], error: null },
    ]);

    const result = await processListingImage(Buffer.from("input"));

    expect(result.facesDetected).toBe(2);
    expect(result.visionOk).toBe(true);
    expect(mockSharpInstance.blur).toHaveBeenCalledTimes(2);
    expect(mockSharpInstance.composite).toHaveBeenCalledOnce();
  });

  it("skips compositing entirely when no face is found", async () => {
    const result = await processListingImage(Buffer.from("input"));

    expect(result.facesDetected).toBe(0);
    expect(mockSharpInstance.composite).not.toHaveBeenCalled();
  });

  it("reports visionOk false when detection throws", async () => {
    mockFaceDetection.mockRejectedValue(new Error("quota exceeded"));

    const result = await processListingImage(Buffer.from("input"));

    expect(result.visionOk).toBe(false);
    expect(result.facesDetected).toBe(0);
    expect(result.webp).toEqual(Buffer.from("processed"));
  });

  it("reports visionOk false when the error rides in the response body", async () => {
    mockFaceDetection.mockResolvedValue([
      { faceAnnotations: [], error: { message: "Bad image data" } },
    ]);

    const result = await processListingImage(Buffer.from("input"));

    expect(result.visionOk).toBe(false);
    expect(result.facesDetected).toBe(0);
  });

  it("drops a face whose bounding box has no area", async () => {
    mockFaceDetection.mockResolvedValue([
      {
        faceAnnotations: [
          { fdBoundingPoly: { vertices: [{ x: 5, y: 5 }] } },
          faceAt(50, 50),
        ],
        error: null,
      },
    ]);

    const result = await processListingImage(Buffer.from("input"));

    expect(result.facesDetected).toBe(1);
  });

  it("keeps a padded face region inside the canvas bounds", async () => {
    mockFaceDetection.mockResolvedValue([
      { faceAnnotations: [faceAt(0, 0, 40)], error: null },
    ]);

    await processListingImage(Buffer.from("input"));

    expect(mockSharpInstance.extract).toHaveBeenCalledWith({
      left: 0,
      top: 0,
      width: 48,
      height: 48,
    });
  });
});

describe("blurPlaceholderDataUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharp.mockReturnValue(mockSharpInstance);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("encodes a tiny jpeg data URL", async () => {
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from("tiny"));

    const result = await blurPlaceholderDataUrl(Buffer.from("image"));

    expect(result).toBe(`data:image/jpeg;base64,${Buffer.from("tiny").toString("base64")}`);
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(32, 32, {
      fit: "inside",
    });
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 60 });
  });

  it("returns null rather than a placeholder over the stored bound", async () => {
    mockSharpInstance.toBuffer.mockResolvedValue(
      Buffer.alloc(MAX_BLUR_DATA_URL_LENGTH),
    );

    expect(await blurPlaceholderDataUrl(Buffer.from("image"))).toBeNull();
  });

  it("returns null when encoding fails", async () => {
    mockSharpInstance.toBuffer.mockRejectedValue(new Error("bad image"));

    expect(await blurPlaceholderDataUrl(Buffer.from("image"))).toBeNull();
  });
});
