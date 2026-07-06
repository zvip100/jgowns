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

type SizeEntry = { size: string; size_group: string; price: number };

const DEFAULT_SIZES: SizeEntry[] = [
  { size: "8", size_group: "adult", price: 800 },
];

function baseFormData(sizes: SizeEntry[] = DEFAULT_SIZES): FormData {
  const fd = new FormData();
  fd.set("title", "Beautiful Gown");
  fd.set("description", "A lovely gown");
  fd.set("color", "Ivory");
  fd.set("location", "Borough Park");
  fd.set("condition", "Brand New");
  fd.set("category", "bridal");
  fd.set("sizes", JSON.stringify(sizes));
  fd.set("sell_mode", "individual");
  fd.set("bundle_price", "");
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

const CREATED_LISTING_ID = "created-listing-1";

type CreateCapture = { payload: unknown; variantRows?: unknown };

function makeCreateSupabase(
  insertCapture: CreateCapture,
  opts: { sizesInsertError?: { message: string } } = {},
) {
  const single = vi
    .fn()
    .mockResolvedValue({ data: { id: CREATED_LISTING_ID }, error: null });
  const listingsInsert = vi.fn().mockImplementation((payload: unknown) => {
    insertCapture.payload = payload;
    return { select: vi.fn().mockReturnValue({ single }) };
  });
  const listingsDeleteEq = vi.fn().mockResolvedValue({ error: null });
  const listingsDelete = vi.fn().mockReturnValue({ eq: listingsDeleteEq });
  const sizesInsert = vi.fn().mockImplementation((rows: unknown) => {
    insertCapture.variantRows = rows;
    return Promise.resolve({ error: opts.sizesInsertError ?? null });
  });

  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: vi.fn().mockImplementation((table: string) =>
      table === "listing_sizes"
        ? { insert: sizesInsert }
        : { insert: listingsInsert, delete: listingsDelete },
    ),
    _sizesInsert: sizesInsert,
    _listingsDelete: listingsDelete,
    _listingsDeleteEq: listingsDeleteEq,
  };
}

type ExistingSizeRow = {
  id: string;
  size: string;
  size_group: string;
  price: number;
  sort_order: number;
};

type UpdateCapture = {
  payload: unknown;
  variantInsert?: unknown;
  variantUpdates?: unknown[];
  variantDeleteIds?: unknown;
};

function makeUpdateSupabase(
  existingImageUrls: string[],
  updateCapture: UpdateCapture,
  updateResult: { error: null | { message: string } } = { error: null },
  existingSizes: ExistingSizeRow[] = [
    { id: "var-8", size: "8", size_group: "adult", price: 800, sort_order: 0 },
  ],
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      user_id: "user-123",
      image_urls: existingImageUrls,
      sizes: existingSizes,
    },
    error: null,
  });

  const innerEq = vi.fn().mockReturnValue(thenableResult(updateResult));
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq });

  const updateFn = vi.fn().mockImplementation((payload: unknown) => {
    updateCapture.payload = payload;
    return { eq: outerEq };
  });

  const sizesInsert = vi.fn().mockImplementation((rows: unknown) => {
    updateCapture.variantInsert = rows;
    return Promise.resolve({ error: null });
  });
  const sizesDeleteIn = vi.fn().mockImplementation((_col: string, ids: unknown) => {
    updateCapture.variantDeleteIds = ids;
    return Promise.resolve({ error: null });
  });
  const sizesDelete = vi.fn().mockReturnValue({ in: sizesDeleteIn });
  const sizesUpdate = vi.fn().mockImplementation((patch: unknown) => {
    updateCapture.variantUpdates = [
      ...(updateCapture.variantUpdates ?? []),
      patch,
    ];
    return { eq: vi.fn().mockResolvedValue({ error: null }) };
  });

  let listingsCallCount = 0;
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "listing_sizes") {
      return { insert: sizesInsert, delete: sizesDelete, update: sizesUpdate };
    }
    listingsCallCount++;
    if (listingsCallCount === 1) {
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
    _sizesInsert: sizesInsert,
    _sizesUpdate: sizesUpdate,
    _sizesDelete: sizesDelete,
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

  it("inserts variant rows in canonical order with sort_order and listing_id", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData([
      { size: "12", size_group: "adult", price: 900 },
      { size: "8", size_group: "adult", price: 800 },
    ]);
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    try { await createListing(fd); } catch { /* redirect */ }

    expect(capture.variantRows).toEqual([
      { size: "8", size_group: "adult", price: 800, sort_order: 0, listing_id: CREATED_LISTING_ID },
      { size: "12", size_group: "adult", price: 900, sort_order: 1, listing_id: CREATED_LISTING_ID },
    ]);
    const payload = capture.payload as Record<string, unknown>;
    expect(payload.sell_mode).toBe("individual");
    expect(payload.bundle_price).toBeNull();
  });

  it("rejects duplicate sizes without uploading", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData([
      { size: "8", size_group: "adult", price: 800 },
      { size: "8", size_group: "adult", price: 850 },
    ]);
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    const result = await createListing(fd);

    expect(result).toEqual({ error: "Each size can only be added once." });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("rejects set_only without a bundle price", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData([
      { size: "8", size_group: "adult", price: 800 },
      { size: "10", size_group: "adult", price: 850 },
    ]);
    fd.set("sell_mode", "set_only");
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    const result = await createListing(fd);

    expect(result).toEqual({ error: "Enter the price for the complete set." });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("stamps the set price onto every variant for set_only (no per-size price)", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set(
      "sizes",
      JSON.stringify([
        { size: "8", size_group: "adult" },
        { size: "10", size_group: "adult" },
      ]),
    );
    fd.set("sell_mode", "set_only");
    fd.set("bundle_price", "1500");
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    try { await createListing(fd); } catch { /* redirect */ }

    expect(capture.variantRows).toEqual([
      { size: "8", size_group: "adult", price: 1500, sort_order: 0, listing_id: CREATED_LISTING_ID },
      { size: "10", size_group: "adult", price: 1500, sort_order: 1, listing_id: CREATED_LISTING_ID },
    ]);
    const payload = capture.payload as Record<string, unknown>;
    expect(payload.sell_mode).toBe("set_only");
    expect(payload.bundle_price).toBe(1500);
  });

  it("rejects an individual size that is missing a price", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("sizes", JSON.stringify([{ size: "8", size_group: "adult" }]));
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    const result = await createListing(fd);

    expect(result).toEqual({ error: "Enter a price for every size." });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("rejects a bundle price when selling individually", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData();
    fd.set("bundle_price", "500");
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    const result = await createListing(fd);

    expect(result).toEqual({
      error: "A set price is only allowed when selling sizes together.",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("stores sell_mode and bundle_price on the listing for 'either'", async () => {
    const capture: CreateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeCreateSupabase(capture),
    });

    const fd = baseFormData([
      { size: "8", size_group: "adult", price: 800 },
      { size: "10", size_group: "adult", price: 850 },
    ]);
    fd.set("sell_mode", "either");
    fd.set("bundle_price", "1500");
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    try { await createListing(fd); } catch { /* redirect */ }

    const payload = capture.payload as Record<string, unknown>;
    expect(payload.sell_mode).toBe("either");
    expect(payload.bundle_price).toBe(1500);
  });

  it("deletes the listing row and images when the variant insert fails", async () => {
    const capture: CreateCapture = { payload: {} };
    const supabase = makeCreateSupabase(capture, {
      sizesInsertError: { message: "variant insert failed" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase,
    });

    const fd = baseFormData();
    fd.set("image_file_0", makeFile());
    fd.set("blur_0", makeBlur("blur0"));

    const result = await createListing(fd);

    expect(result).toEqual({ error: "variant insert failed" });
    expect(supabase._listingsDelete).toHaveBeenCalled();
    expect(supabase._listingsDeleteEq).toHaveBeenCalledWith("id", CREATED_LISTING_ID);
    expect(mockDeleteListingImages).toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
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

  it("diffs variants: updates changed prices, inserts new sizes, deletes removed ones", async () => {
    const capture: UpdateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0], capture, { error: null }, [
        { id: "var-8", size: "8", size_group: "adult", price: 800, sort_order: 0 },
        { id: "var-10", size: "10", size_group: "adult", price: 850, sort_order: 1 },
      ]),
    });

    const fd = baseFormData([
      { size: "8", size_group: "adult", price: 825 },
      { size: "12", size_group: "adult", price: 900 },
    ]);
    fd.set("existing_url_0", OLD_URL_0);
    fd.set("blur_0", makeBlur("blur0"));

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    expect(capture.variantDeleteIds).toEqual(["var-10"]);
    expect(capture.variantUpdates).toEqual([{ price: 825, sort_order: 0 }]);
    expect(capture.variantInsert).toEqual([
      { size: "12", size_group: "adult", price: 900, sort_order: 1, listing_id: LISTING_ID },
    ]);
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
  });

  it("stamps the set price onto every variant when switching to set_only", async () => {
    const capture: UpdateCapture = { payload: {} };
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase: makeUpdateSupabase([OLD_URL_0], capture, { error: null }, [
        { id: "var-8", size: "8", size_group: "adult", price: 800, sort_order: 0 },
        { id: "var-10", size: "10", size_group: "adult", price: 850, sort_order: 1 },
      ]),
    });

    const fd = baseFormData();
    fd.set(
      "sizes",
      JSON.stringify([
        { size: "8", size_group: "adult" },
        { size: "10", size_group: "adult" },
      ]),
    );
    fd.set("sell_mode", "set_only");
    fd.set("bundle_price", "1200");
    fd.set("existing_url_0", OLD_URL_0);
    fd.set("blur_0", makeBlur("blur0"));

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    expect(capture.variantUpdates).toEqual([
      { price: 1200, sort_order: 0 },
      { price: 1200, sort_order: 1 },
    ]);
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
  });

  it("performs no variant writes when the submitted sizes match the stored ones", async () => {
    const capture: UpdateCapture = { payload: {} };
    const supabase = makeUpdateSupabase([OLD_URL_0], capture);
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      user: { id: "user-123" },
      supabase,
    });

    const fd = baseFormData();
    fd.set("title", "Beautiful Gown (edited)");
    fd.set("existing_url_0", OLD_URL_0);
    fd.set("blur_0", makeBlur("blur0"));

    try { await updateListing(LISTING_ID, fd); } catch { /* redirect */ }

    expect(supabase._sizesInsert).not.toHaveBeenCalled();
    expect(supabase._sizesUpdate).not.toHaveBeenCalled();
    expect(supabase._sizesDelete).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });
});
