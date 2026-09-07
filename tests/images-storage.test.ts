import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LISTING_IMAGE_BUCKET,
  downloadListingImage,
  listingImagePathFromUrl,
  unreferencedListingImageUrls,
  uploadListingImage,
} from "@/lib/images/storage";

import type { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseServer } from "@/lib/actions/auth";

const SUPABASE_URL = "https://test.supabase.co";

function makeSupabaseUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/${path}`;
}

const upload = vi.fn();
const download = vi.fn();
const getPublicUrl = vi.fn();
const from = vi.fn(() => ({ upload, download, getPublicUrl }));

/** Only `.storage` is ever touched here; the rest of the client is irrelevant. */
const supabase = { storage: { from } } as unknown as SupabaseServer;

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  getPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: makeSupabaseUrl(path) },
  }));
});

describe("uploadListingImage", () => {
  it("writes to a fresh path and returns its public URL", async () => {
    const file = new File([Buffer.from("bytes")], "photo.jpg", {
      type: "image/jpeg",
    });

    const url = await uploadListingImage({
      supabase,
      body: file,
      contentType: file.type,
    });

    expect(from).toHaveBeenCalledWith(LISTING_IMAGE_BUCKET);
    const [path, body, options] = upload.mock.calls[0];
    expect(path).toMatch(/^[0-9a-f-]{36}-\d+\.jpg$/);
    expect(body).toBe(file);
    expect(options).toEqual({ contentType: "image/jpeg" });
    expect(url).toBe(makeSupabaseUrl(path));
  });

  it("names a webp buffer by its content type rather than defaulting to jpg", async () => {
    await uploadListingImage({
      supabase,
      body: Buffer.from("bytes"),
      contentType: "image/webp",
    });

    expect(upload.mock.calls[0][0]).toMatch(/\.webp$/);
    expect(upload.mock.calls[0][2]).toEqual({ contentType: "image/webp" });
  });

  it("falls back to a jpg extension for an unrecognized content type", async () => {
    await uploadListingImage({
      supabase,
      body: Buffer.from("bytes"),
      contentType: "image/tiff",
    });

    expect(upload.mock.calls[0][0]).toMatch(/\.jpg$/);
  });

  it("writes an admin upload under the listing's own prefix", async () => {
    const listingId = "11111111-1111-4111-8111-111111111111";

    const url = await uploadListingImage({
      supabase,
      body: Buffer.from("bytes"),
      contentType: "image/webp",
      listingId,
    });

    const path = upload.mock.calls[0][0];
    // The prefix is the provenance the storage delete policy reads. A seller
    // cannot move an object into it, which is why it is trustworthy where
    // listings.image_urls (seller-writable) is not.
    expect(path).toMatch(
      new RegExp(`^admin/${listingId}/[0-9a-f-]{36}-\\d+\\.webp$`),
    );
    expect(url).toBe(makeSupabaseUrl(path));
  });

  it("round-trips an admin path back to a bucket path", async () => {
    const listingId = "11111111-1111-4111-8111-111111111111";

    const url = await uploadListingImage({
      supabase,
      body: Buffer.from("bytes"),
      contentType: "image/webp",
      listingId,
    });

    expect(listingImagePathFromUrl(url)).toBe(upload.mock.calls[0][0]);
  });

  it("never reuses a path across two uploads", async () => {
    await uploadListingImage({
      supabase,
      body: Buffer.from("a"),
      contentType: "image/webp",
    });
    await uploadListingImage({
      supabase,
      body: Buffer.from("b"),
      contentType: "image/webp",
    });

    expect(upload.mock.calls[0][0]).not.toBe(upload.mock.calls[1][0]);
  });

  it("throws with the storage message when the upload fails", async () => {
    upload.mockResolvedValue({ error: { message: "bucket full" } });

    await expect(
      uploadListingImage({
        supabase,
        body: Buffer.from("bytes"),
        contentType: "image/webp",
      }),
    ).rejects.toThrow("bucket full");
  });
});

describe("downloadListingImage", () => {
  it("resolves the bucket path and returns the bytes as a Buffer", async () => {
    download.mockResolvedValue({ data: new Blob(["image-bytes"]), error: null });

    const result = await downloadListingImage(
      supabase,
      makeSupabaseUrl("nested/photo.webp"),
    );

    expect(download).toHaveBeenCalledWith("nested/photo.webp");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("image-bytes");
  });

  it("throws for a URL outside this project's bucket", async () => {
    await expect(
      downloadListingImage(supabase, "https://cloudinary.com/photo.jpg"),
    ).rejects.toThrow("bucket");
    expect(download).not.toHaveBeenCalled();
  });

  it("throws with the storage message when the download fails", async () => {
    download.mockResolvedValue({ data: null, error: { message: "not found" } });

    await expect(
      downloadListingImage(supabase, makeSupabaseUrl("gone.webp")),
    ).rejects.toThrow("not found");
  });

  it("throws when storage returns neither data nor an error", async () => {
    download.mockResolvedValue({ data: null, error: null });

    await expect(
      downloadListingImage(supabase, makeSupabaseUrl("empty.webp")),
    ).rejects.toThrow("could not be downloaded");
  });
});

describe("unreferencedListingImageUrls", () => {
  const overlaps = vi.fn();
  const select = vi.fn(() => ({ overlaps }));
  const serviceFrom = vi.fn(() => ({ select }));
  /** Only `.from("listings")` is ever touched here. */
  const service = { from: serviceFrom } as unknown as ReturnType<
    typeof createServiceClient
  >;

  it("returns every url when no listing references any of them", async () => {
    overlaps.mockResolvedValue({ data: [], error: null });

    await expect(
      unreferencedListingImageUrls(service, ["a.webp", "b.webp"]),
    ).resolves.toEqual(["a.webp", "b.webp"]);
    expect(serviceFrom).toHaveBeenCalledWith("listings");
    expect(overlaps).toHaveBeenCalledWith("image_urls", ["a.webp", "b.webp"]);
  });

  // The whole point: image_urls is seller-writable, so one listing can name
  // another's photo, and both callers delete with bucket-wide authority.
  it("holds back a url a surviving listing still shows", async () => {
    overlaps.mockResolvedValue({
      data: [{ image_urls: ["b.webp", "unrelated.webp"] }],
      error: null,
    });

    await expect(
      unreferencedListingImageUrls(service, ["a.webp", "b.webp"]),
    ).resolves.toEqual(["a.webp"]);
  });

  it("holds back everything when the check fails, rather than guessing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    overlaps.mockResolvedValue({ data: null, error: { message: "read failed" } });

    await expect(
      unreferencedListingImageUrls(service, ["a.webp"]),
    ).resolves.toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("tolerates a row with no image array", async () => {
    overlaps.mockResolvedValue({ data: [{ image_urls: null }], error: null });

    await expect(
      unreferencedListingImageUrls(service, ["a.webp"]),
    ).resolves.toEqual(["a.webp"]);
  });

  it("asks nothing of the database for an empty list", async () => {
    await expect(unreferencedListingImageUrls(service, [])).resolves.toEqual([]);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});

describe("listingImagePathFromUrl", () => {
  it("extracts the path after the public object marker", () => {
    expect(listingImagePathFromUrl(makeSupabaseUrl("photo.webp"))).toBe(
      "photo.webp",
    );
  });

  it("decodes an escaped path", () => {
    expect(listingImagePathFromUrl(makeSupabaseUrl("a%20b.webp"))).toBe(
      "a b.webp",
    );
  });

  it("returns null for a URL from another host's bucket layout", () => {
    expect(listingImagePathFromUrl("https://cloudinary.com/photo.jpg")).toBeNull();
  });

  it("returns null when the marker is present but the path is empty", () => {
    expect(listingImagePathFromUrl(makeSupabaseUrl(""))).toBeNull();
  });

  it("returns null for a string that is not a URL", () => {
    expect(listingImagePathFromUrl("not a url")).toBeNull();
  });
});
