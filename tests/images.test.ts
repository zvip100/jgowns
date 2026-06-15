import { describe, it, expect, vi, beforeEach } from "vitest";

const SUPABASE_URL = "https://test.supabase.co";

const {
  mockSharp,
  mockSharpInstance,
  mockFaceDetection,
  mockRemove,
  mockAuth,
} = vi.hoisted(() => {
  const mockRemove = vi.fn().mockResolvedValue({ error: null });
  const mockStorage = {
    from: vi.fn().mockReturnValue({ remove: mockRemove }),
  };
  const mockSupabase = { storage: mockStorage };
  const mockAuth = vi.fn().mockResolvedValue({ ok: true, supabase: mockSupabase });

  const mockFaceDetection = vi.fn().mockResolvedValue([{ faceAnnotations: [], error: null }]);

  const mockSharpInstance = {
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed")),
    webp: vi.fn().mockReturnThis(),
    extract: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
  };
  const mockSharp = vi.fn().mockReturnValue(mockSharpInstance);

  return { mockSharp, mockSharpInstance, mockFaceDetection, mockRemove, mockAuth };
});

vi.mock("sharp", () => ({ default: mockSharp }));
vi.mock("@google-cloud/vision", () => ({
  default: {
    // Must use regular function (not arrow) so `new` works
    ImageAnnotatorClient: vi.fn().mockImplementation(function () {
      return { faceDetection: mockFaceDetection };
    }),
  },
}));
vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockAuth }));

process.env.GOOGLE_CLOUD_PROJECT_ID = "test-project";
process.env.GOOGLE_CLOUD_CLIENT_EMAIL = "test@test.iam.gserviceaccount.com";
process.env.GOOGLE_CLOUD_PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;

import {
  optimizeListingPhoto,
  deleteListingImages,
} from "@/lib/actions/images";

function makeImageFile(type = "image/jpeg"): File {
  return new File([Buffer.from("fake-image-data")], "photo.jpg", { type });
}

function makeSupabaseUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/gown-images/${path}`;
}

describe("optimizeListingPhoto", () => {
  beforeEach(() => {
    mockSharp.mockClear();
    mockSharpInstance.resize.mockClear();
    mockSharpInstance.webp.mockClear();
    mockSharpInstance.toBuffer.mockClear();
    mockFaceDetection.mockClear();
    mockFaceDetection.mockResolvedValue([{ faceAnnotations: [], error: null }]);
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from("processed"));
  });

  it("returns a data URL for a valid image and invokes sharp + vision", async () => {
    const formData = new FormData();
    formData.set("image", makeImageFile());

    const result = await optimizeListingPhoto(formData);

    expect("dataUrl" in result).toBe(true);
    if ("dataUrl" in result) {
      expect(result.dataUrl).toMatch(/^data:image\/webp;base64,/);
    }
    expect(mockSharp).toHaveBeenCalled();
    expect(mockFaceDetection).toHaveBeenCalled();
  });

  it("returns an error and does not call sharp for a non-image MIME type", async () => {
    const formData = new FormData();
    formData.set("image", new File(["data"], "doc.pdf", { type: "application/pdf" }));

    const result = await optimizeListingPhoto(formData);

    expect("error" in result).toBe(true);
    expect(mockSharp).not.toHaveBeenCalled();
  });

  it("returns an error and does not call sharp when the field is a plain string", async () => {
    const formData = new FormData();
    formData.set("image", "not-a-file");

    const result = await optimizeListingPhoto(formData);

    expect("error" in result).toBe(true);
    expect(mockSharp).not.toHaveBeenCalled();
  });
});

describe("deleteListingImages", () => {
  beforeEach(() => {
    mockRemove.mockClear();
    mockRemove.mockResolvedValue({ error: null });
  });

  it("deletes all Supabase URLs in a single batch remove call", async () => {
    const urls = [
      makeSupabaseUrl("img1.webp"),
      makeSupabaseUrl("img2.webp"),
      makeSupabaseUrl("img3.webp"),
    ];

    const result = await deleteListingImages(urls);

    expect(result).toEqual({ ok: true });
    expect(mockRemove).toHaveBeenCalledOnce();
    expect(mockRemove).toHaveBeenCalledWith(["img1.webp", "img2.webp", "img3.webp"]);
  });

  it("skips non-Supabase URLs and only removes valid paths", async () => {
    const urls = [
      makeSupabaseUrl("real.webp"),
      "https://cloudinary.com/image.jpg",
      "",
    ];

    const result = await deleteListingImages(urls);

    expect(result).toEqual({ ok: true });
    expect(mockRemove).toHaveBeenCalledOnce();
    expect(mockRemove).toHaveBeenCalledWith(["real.webp"]);
  });

  it("returns ok without calling remove when all URLs are non-Supabase", async () => {
    const result = await deleteListingImages(["https://other.com/img.jpg"]);

    expect(result).toEqual({ ok: true });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("returns ok for an empty array", async () => {
    const result = await deleteListingImages([]);

    expect(result).toEqual({ ok: true });
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
