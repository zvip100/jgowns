import { describe, it, expect, vi, beforeEach } from "vitest";

const SUPABASE_URL = "https://test.supabase.co";

function makeSupabaseUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/gown-images/${path}`;
}

const {
  mockInsert,
  mockUpload,
  mockGetPublicUrl,
  mockUpdateTag,
  mockRedirect,
  mockDeleteListingImages,
  mockGetAuthClient,
} = vi.hoisted(() => {
  let urlCounter = 0;
  const mockGetPublicUrl = vi.fn().mockImplementation(() => ({
    data: { publicUrl: makeSupabaseUrl(`img-${++urlCounter}.webp`) },
  }));
  const mockUpload = vi.fn().mockResolvedValue({ error: null });
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockUpdateTag = vi.fn();
  const mockRedirect = vi.fn().mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  const mockDeleteListingImages = vi.fn().mockResolvedValue({ ok: true });
  const mockGetAuthClient = vi.fn();

  return {
    mockInsert,
    mockUpload,
    mockGetPublicUrl,
    mockUpdateTag,
    mockRedirect,
    mockDeleteListingImages,
    mockGetAuthClient,
  };
});

vi.mock("next/cache", () => ({ updateTag: mockUpdateTag }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockGetAuthClient }));
vi.mock("@/lib/actions/images", () => ({
  deleteListingImages: mockDeleteListingImages,
}));

import { createListing, updateListing } from "@/lib/actions/sell";

function makeFile(name = "photo.webp"): File {
  return new File([Buffer.from("fake")], name, { type: "image/webp" });
}

function makeBlur(tag: string): string {
  return `data:image/jpeg;base64,${tag}`;
}

function baseFormData(): FormData {
  const fd = new FormData();
  fd.set("title", "Beautiful Gown");
  fd.set("description", "A lovely gown");
  fd.set("size", "8");
  fd.set("size_group", "adult");
  fd.set("color", "Ivory");
  fd.set("location", "Borough Park");
  fd.set("condition", "Brand New");
  fd.set("category", "bridal");
  fd.set("price", "800");
  fd.set("contact_email", "seller@example.com");
  fd.set("contact_phone", "");
  fd.set("status", "active");
  return fd;
}

/** Creates a thenable Supabase-style result that can be `await`ed. */
function thenableResult(value: { error: null | { message: string } }) {
  return {
    ...value,
    then(
      resolve: (v: typeof value) => unknown,
      _reject?: (e: unknown) => unknown,
    ) {
      return Promise.resolve(value).then(resolve, _reject);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve(value).catch(reject);
    },
  };
}

function makeCreateSupabase(insertCapture: { payload: unknown }) {
  const insertFn = vi.fn().mockImplementation((payload: unknown) => {
    insertCapture.payload = payload;
    return Promise.resolve({ error: null });
  });

  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: insertFn,
    }),
  };
}

function makeUpdateSupabase(
  existingImageUrls: string[],
  updateCapture: { payload: unknown },
  updateResult: { error: null | { message: string } } = { error: null },
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { user_id: "user-123", image_urls: existingImageUrls },
    error: null,
  });

  const innerEq = vi.fn().mockReturnValue(thenableResult(updateResult));
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq });

  const updateFn = vi.fn().mockImplementation((payload: unknown) => {
    updateCapture.payload = payload;
    return { eq: outerEq };
  });

  let callCount = 0;
  const from = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle,
      };
    }
    return { update: updateFn };
  });

  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from,
  };
}

describe("createListing", () => {
  beforeEach(() => {
    mockUpload.mockClear();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockClear();
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateTag.mockClear();
    mockRedirect.mockClear();
    mockDeleteListingImages.mockClear();
    mockDeleteListingImages.mockResolvedValue({ ok: true });
    mockRedirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    let counter = 0;
    mockGetPublicUrl.mockImplementation(() => ({
      data: { publicUrl: makeSupabaseUrl(`img-${++counter}.webp`) },
    }));
  });

  it("inserts with image_urls length 1 when 1 image slot provided", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", "data:image/jpeg;base64,abc");

    try { await createListing(fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect(Array.isArray(payload.image_urls)).toBe(true);
    expect((payload.image_urls as string[]).length).toBe(1);
    expect((payload.image_blur_data_urls as string[])[0]).toBe("data:image/jpeg;base64,abc");
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("inserts with image_urls length 3 when 3 image slots provided", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile("a.webp"));
    fd.set("blur_0", makeBlur("blur0"));
    fd.set("image_file_1", makeFile("b.webp"));
    fd.set("blur_1", makeBlur("blur1"));
    fd.set("image_file_2", makeFile("c.webp"));
    fd.set("blur_2", makeBlur("blur2"));

    try { await createListing(fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect((payload.image_urls as string[]).length).toBe(3);
    expect(payload.image_blur_data_urls).toEqual([
      makeBlur("blur0"),
      makeBlur("blur1"),
      makeBlur("blur2"),
    ]);
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it("rejects a contact_phone containing letters (shared optionalPhoneSchema)", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("contact_phone", "555-CALL-NOW");
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", "data:image/jpeg;base64,abc");

    const result = await createListing(fd);

    expect(result).toEqual({
      error: "Leave phone blank, or enter a valid phone number.",
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns an error and does not insert when 0 image slots provided", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    const result = await createListing(fd);

    expect(result).toHaveProperty("error");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("calls updateTag('listings') after a successful insert", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", "");

    try { await createListing(fd); } catch { /* redirect */ }

    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("cleans up the first uploaded URL when the second upload throws", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    let firstUploadedUrl: string;
    mockUpload
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error("upload failed"));

    const fd = baseFormData();
    fd.set("image_file_0", makeFile("a.webp"));
    fd.set("blur_0", makeBlur("blur0"));
    fd.set("image_file_1", makeFile("b.webp"));
    fd.set("blur_1", makeBlur("blur1"));

    // Capture the URL that getPublicUrl returns for the first successful upload.
    // The beforeEach counter starts at 0, so the first call yields img-1.webp.
    firstUploadedUrl = makeSupabaseUrl("img-1.webp");

    const result = await createListing(fd);

    expect(result).toHaveProperty("error");
    expect(mockDeleteListingImages).toHaveBeenCalledWith([firstUploadedUrl]);
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns an error without uploading when a slot has an existing_url but no file", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));
    fd.set("existing_url_1", makeSupabaseUrl("kept.webp"));
    fd.set("blur_1", makeBlur("blur1"));

    const result = await createListing(fd);

    expect(result).toHaveProperty("error");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("stores an empty blur when the submitted blur is not a small image data URL", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile("a.webp"));
    fd.set("blur_0", "javascript:alert(1)");
    fd.set("image_file_1", makeFile("b.webp"));
    fd.set("blur_1", `data:image/jpeg;base64,${"a".repeat(5000)}`);

    try { await createListing(fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect(payload.image_blur_data_urls).toEqual(["", ""]);
  });
});

describe("updateListing", () => {
  const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const OLD_URL_0 = makeSupabaseUrl("old-0.webp");
  const OLD_URL_1 = makeSupabaseUrl("old-1.webp");

  beforeEach(() => {
    mockUpload.mockClear();
    mockUpload.mockResolvedValue({ error: null });
    mockUpdateTag.mockClear();
    mockRedirect.mockClear();
    mockDeleteListingImages.mockClear();
    mockDeleteListingImages.mockResolvedValue({ ok: true });
    mockRedirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    let counter = 0;
    mockGetPublicUrl.mockImplementation(() => ({
      data: { publicUrl: makeSupabaseUrl(`new-${++counter}.webp`) },
    }));
  });

  it("drops slot 1 and calls deleteListingImages with the orphaned URL", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0, OLD_URL_1], capture),
    });

    const fd = baseFormData();
    fd.set("existing_url_0", OLD_URL_0);
    fd.set("blur_0", makeBlur("blur0"));
    // slot 1 is NOT submitted — it is removed

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect(payload.image_urls).toEqual([OLD_URL_0]);
    expect(mockDeleteListingImages).toHaveBeenCalledWith([OLD_URL_1]);
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("does not call deleteListingImages when all existing images are kept", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0, OLD_URL_1], capture),
    });

    const fd = baseFormData();
    fd.set("existing_url_0", OLD_URL_0);
    fd.set("blur_0", makeBlur("blur0"));
    fd.set("existing_url_1", OLD_URL_1);
    fd.set("blur_1", makeBlur("blur1"));

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns an error without updating when 0 slots provided", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0], capture),
    });

    const fd = baseFormData();
    const result = await updateListing(LISTING_ID, fd);

    expect(result).toHaveProperty("error");
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("cleans up the first new upload when a second upload throws mid-loop", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0], capture),
    });

    mockUpload
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error("upload failed"));

    // The beforeEach counter resets, so the first getPublicUrl call yields new-1.webp.
    const firstNewUrl = makeSupabaseUrl("new-1.webp");

    const fd = baseFormData();
    fd.set("image_file_0", makeFile("a.webp"));
    fd.set("blur_0", makeBlur("blur0"));
    fd.set("image_file_1", makeFile("b.webp"));
    fd.set("blur_1", makeBlur("blur1"));

    const result = await updateListing(LISTING_ID, fd);

    expect(result).toHaveProperty("error");
    expect(mockDeleteListingImages).toHaveBeenCalledWith([firstNewUrl]);
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("builds correct image_urls and orphan list for a mixed new-file and kept-URL slot", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0, OLD_URL_1], capture),
    });

    // The beforeEach counter resets, so the uploaded slot will get new-1.webp.
    const uploadedUrl = makeSupabaseUrl("new-1.webp");

    const fd = baseFormData();
    fd.set("image_file_0", makeFile("new.webp")); // slot 0: new file
    fd.set("blur_0", makeBlur("blurNew"));
    fd.set("existing_url_1", OLD_URL_1); // slot 1: keep OLD_URL_1
    fd.set("blur_1", makeBlur("blurOld1"));

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect(payload.image_urls).toEqual([uploadedUrl, OLD_URL_1]);
    expect(payload.image_blur_data_urls).toEqual([
      makeBlur("blurNew"),
      makeBlur("blurOld1"),
    ]);
    expect(mockDeleteListingImages).toHaveBeenCalledWith([OLD_URL_0]);
  });

  it("returns an error when an existingUrl slot is not in the listing's current image_urls", async () => {
    const capture = { payload: {} as unknown };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0], capture),
    });

    const fd = baseFormData();
    fd.set("existing_url_0", "https://example.com/not-in-list.webp");
    fd.set("blur_0", makeBlur("blur0"));

    const result = await updateListing(LISTING_ID, fd);

    expect(result).toEqual({ error: "Invalid existing image URL." });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
