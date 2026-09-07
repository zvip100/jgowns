import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminActionClient,
  mockUpdateTag,
  mockRpc,
  mockFrom,
  mockDeleteListingImages,
  mockProcessListingImage,
  mockBlurPlaceholderDataUrl,
  mockDownloadListingImage,
  mockUploadListingImage,
  calls,
} = vi.hoisted(() => ({
  mockGetAdminActionClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockDeleteListingImages: vi.fn(),
  mockProcessListingImage: vi.fn(),
  mockBlurPlaceholderDataUrl: vi.fn(),
  mockDownloadListingImage: vi.fn(),
  mockUploadListingImage: vi.fn(),
  calls: [] as string[],
}));

vi.mock("next/cache", () => ({ updateTag: mockUpdateTag }));
vi.mock("@/lib/admin/guard", () => ({
  getAdminActionClient: mockGetAdminActionClient,
  ADMIN_NOT_AUTHORIZED_ERROR: "Not authorized",
  ADMIN_DEMO_MODE_ERROR: "Turn off demo mode to make changes.",
  ADMIN_UNEXPECTED_ERROR: "Something went wrong. Please try again.",
  // The wrapper's own behaviour is covered against the real one in
  // tests/admin-guard.test.ts; here it only has to route through the mocked
  // guard so each action's own logic is what these tests exercise.
  runAdminAction: async (
    _scope: string,
    run: (auth: unknown) => Promise<{ error?: string }>,
  ) => {
    const auth = await mockGetAdminActionClient();
    if (!auth.ok) return { error: auth.error };
    try {
      return await run(auth);
    } catch {
      return { error: "Something went wrong. Please try again." };
    }
  },
}));
vi.mock("@/lib/actions/images", () => ({
  deleteListingImages: mockDeleteListingImages,
}));
vi.mock("@/lib/images/pipeline", () => ({
  processListingImage: mockProcessListingImage,
  blurPlaceholderDataUrl: mockBlurPlaceholderDataUrl,
}));
vi.mock("@/lib/images/storage", () => ({
  downloadListingImage: mockDownloadListingImage,
  uploadListingImage: mockUploadListingImage,
}));

import {
  adminAddListingImage,
  adminMarkListingSold,
  adminMarkSizeSold,
  adminMoveListingImage,
  adminReactivateListing,
  adminReactivateSize,
  adminRemoveListing,
  adminRemoveListingImage,
  adminReplaceListingImage,
  adminReprocessListingImage,
  adminRestoreListing,
  adminSuspendListing,
  adminUpdateListing,
} from "@/lib/actions/admin/listings";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID = "22222222-2222-4222-8222-222222222222";
const IMAGE_URL =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/a.webp";
const NEW_IMAGE_URL =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/b.webp";

type MaybeError = {
  data?: string[] | null;
  error: null | { message: string; code?: string };
};

/**
 * The one authorized client every action is handed. Held as a constant so a
 * test can assert the cleanup helper was passed THIS client rather than left to
 * reacquire a session of its own.
 */
const SUPABASE = { rpc: mockRpc, from: mockFrom };

/** A picked photo, as it crosses the server-action boundary. */
function photoForm(
  file: File = new File([new Uint8Array([1, 2, 3])], "gown.jpg", {
    type: "image/jpeg",
  }),
): FormData {
  const formData = new FormData();
  formData.set("photo", file);
  return formData;
}

/** One chainable stub standing in for whatever `.from(...)` chain runs next. */
function tableStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  // A terminal `.select("id")` resolves rather than chaining, so the chain is
  // thenable too and both shapes work off one stub.
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

function allowAdmin(): void {
  mockGetAdminActionClient.mockResolvedValue({
    ok: true,
    supabase: SUPABASE,
    admin: { id: "admin-1", email: "admin@jgowns.com" },
  });
}

function formDataFor(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    title: "Ivory lace gown",
    description: "Worn once.",
    color: "Ivory",
    location: "Monsey",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: "",
    sizes: JSON.stringify([{ size: "8", size_group: "adult", price: 400 }]),
    contact_email: "seller@example.com",
    contact_phone: "",
    contact_methods: "[]",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  allowAdmin();
  mockRpc.mockImplementation(async (name: string) => {
    calls.push(`rpc:${name}`);
    // The photo RPCs return the array they committed; the shape is what the
    // delete guard reads, so the default is a committed array without the URL
    // any of these tests acts on.
    return { data: [NEW_IMAGE_URL], error: null } satisfies MaybeError;
  });
  mockFrom.mockImplementation(() =>
    tableStub({ data: { status: "active" }, error: null }),
  );
  mockDeleteListingImages.mockImplementation(async () => {
    calls.push("storage:delete");
    return { ok: true };
  });
  mockDownloadListingImage.mockImplementation(async () => {
    calls.push("storage:download");
    return Buffer.from("original");
  });
  mockProcessListingImage.mockImplementation(async () => {
    calls.push("pipeline");
    return { webp: Buffer.from("reprocessed"), facesDetected: 1, visionOk: true };
  });
  mockBlurPlaceholderDataUrl.mockResolvedValue("data:image/jpeg;base64,tiny");
  mockUploadListingImage.mockImplementation(async () => {
    calls.push("storage:upload");
    return NEW_IMAGE_URL;
  });
});

/** Every export, so a new action cannot skip the guard by being forgotten. */
const ALL_ACTIONS: [string, () => Promise<{ error?: string }>][] = [
  ["adminSuspendListing", () => adminSuspendListing(LISTING_ID, { slug: "spam" })],
  ["adminRestoreListing", () => adminRestoreListing(LISTING_ID)],
  ["adminRemoveListing", () => adminRemoveListing(LISTING_ID)],
  ["adminMarkListingSold", () => adminMarkListingSold(LISTING_ID)],
  ["adminReactivateListing", () => adminReactivateListing(LISTING_ID)],
  ["adminMarkSizeSold", () => adminMarkSizeSold(LISTING_ID, SIZE_ID)],
  ["adminReactivateSize", () => adminReactivateSize(LISTING_ID, SIZE_ID)],
  ["adminUpdateListing", () => adminUpdateListing(LISTING_ID, formDataFor())],
  [
    "adminRemoveListingImage",
    () => adminRemoveListingImage(LISTING_ID, IMAGE_URL),
  ],
  [
    "adminReprocessListingImage",
    () => adminReprocessListingImage(LISTING_ID, IMAGE_URL),
  ],
  [
    "adminReplaceListingImage",
    () => adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
  ],
  ["adminAddListingImage", () => adminAddListingImage(LISTING_ID, photoForm())],
  [
    "adminMoveListingImage",
    () => adminMoveListingImage(LISTING_ID, 1, IMAGE_URL, 1),
  ],
];

describe("admin listing actions: guard", () => {
  it("returns the guard's error and touches nothing when the caller is not an admin", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      mockGetAdminActionClient.mockResolvedValue({
        ok: false,
        error: "Not authorized",
      });

      await expect(run(), name).resolves.toEqual({ error: "Not authorized" });
      expect(mockRpc, name).not.toHaveBeenCalled();
      expect(mockFrom, name).not.toHaveBeenCalled();
      expect(mockUpdateTag, name).not.toHaveBeenCalled();
      expect(mockDeleteListingImages, name).not.toHaveBeenCalled();
    }
  });

  it("refuses a demo-mode request before any write, for every action", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      mockGetAdminActionClient.mockResolvedValue({
        ok: false,
        error: "Turn off demo mode to make changes.",
      });

      await expect(run(), name).resolves.toEqual({
        error: "Turn off demo mode to make changes.",
      });
      expect(mockRpc, name).not.toHaveBeenCalled();
      expect(mockUpdateTag, name).not.toHaveBeenCalled();
    }
  });

  it("never reaches for the service client", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/actions/admin/listings.ts", "utf8"),
    );
    expect(source).not.toContain("createServiceClient");
  });
});

describe("admin listing actions: id validation", () => {
  it("rejects an empty, malformed, or non-string listing id before any call", async () => {
    for (const bad of ["", "listing-1", 7 as unknown as string]) {
      vi.clearAllMocks();
      allowAdmin();
      await expect(adminRestoreListing(bad)).resolves.toEqual({
        error: "Invalid listing id",
      });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockUpdateTag).not.toHaveBeenCalled();
    }
  });

  it("rejects a malformed size id on both per-size actions", async () => {
    await expect(adminMarkSizeSold(LISTING_ID, "size-1")).resolves.toEqual({
      error: "Invalid size id",
    });
    await expect(adminReactivateSize(LISTING_ID, "size-1")).resolves.toEqual({
      error: "Invalid size id",
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("adminSuspendListing", () => {
  it("passes the slug and trimmed note straight through to the RPC", async () => {
    await expect(
      adminSuspendListing(LISTING_ID, {
        slug: "image-policy",
        note: "  Blur the faces.  ",
      }),
    ).resolves.toEqual({});

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_suspend_listing", {
      p_listing_id: LISTING_ID,
      p_slug: "image-policy",
      p_note: "Blur the faces.",
    });
  });

  it("sends null, not an empty string, when the note is absent or blank", async () => {
    await adminSuspendListing(LISTING_ID, { slug: "spam" });
    expect(mockRpc.mock.calls[0][1].p_note).toBeNull();

    mockRpc.mockClear();
    await adminSuspendListing(LISTING_ID, { slug: "spam", note: "   " });
    expect(mockRpc.mock.calls[0][1].p_note).toBeNull();
  });

  it("rejects an unknown or missing slug without calling the RPC", async () => {
    // Cast because the point is the runtime guard, not the compiler's.
    const badSlugs = ["not-a-slug", "", undefined] as unknown as "spam"[];
    for (const slug of badSlugs) {
      mockRpc.mockClear();
      const result = await adminSuspendListing(LISTING_ID, { slug });
      expect(result.error).toBeTruthy();
      expect(mockRpc).not.toHaveBeenCalled();
    }
  });

  it("rejects a note past the length limit without calling the RPC", async () => {
    const result = await adminSuspendListing(LISTING_ID, {
      slug: "spam",
      note: "x".repeat(501),
    });
    expect(result.error).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("invalidates the listing tag and the collection tag exactly once each", async () => {
    await adminSuspendListing(LISTING_ID, { slug: "spam" });
    expect(mockUpdateTag.mock.calls).toEqual([
      [`listing:${LISTING_ID}`],
      ["listings"],
    ]);
  });

  it("writes no audit row of its own: the trigger owns it", async () => {
    await adminSuspendListing(LISTING_ID, { slug: "spam" });
    expect(mockRpc).not.toHaveBeenCalledWith(
      "admin_log_event",
      expect.anything(),
    );
  });
});

describe("adminRestoreListing", () => {
  it("calls the restore RPC with only the listing id and invalidates both tags", async () => {
    await expect(adminRestoreListing(LISTING_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_restore_listing", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag.mock.calls).toEqual([
      [`listing:${LISTING_ID}`],
      ["listings"],
    ]);
  });
});

describe("adminRemoveListing", () => {
  it("calls the remove RPC with only the listing id and invalidates both tags", async () => {
    await expect(adminRemoveListing(LISTING_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("remove_listing", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag.mock.calls).toEqual([
      [`listing:${LISTING_ID}`],
      ["listings"],
    ]);
  });

  it("writes no audit row of its own: the trigger owns it", async () => {
    await adminRemoveListing(LISTING_ID);
    expect(mockRpc).not.toHaveBeenCalledWith(
      "admin_log_event",
      expect.anything(),
    );
  });

  it("rejects an invalid listing id without calling the RPC", async () => {
    await expect(adminRemoveListing("not-a-uuid")).resolves.toEqual({
      error: "Invalid listing id",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("admin status support actions", () => {
  it("routes mark sold through the widened seller RPC", async () => {
    await expect(adminMarkListingSold(LISTING_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("mark_listing_sold", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("routes reactivate through the widened seller RPC", async () => {
    await expect(adminReactivateListing(LISTING_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("reactivate_listing", {
      p_listing_id: LISTING_ID,
    });
  });

  it("routes per-size sold through the widened seller RPC", async () => {
    await expect(adminMarkSizeSold(LISTING_ID, SIZE_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("mark_size_sold", {
      p_listing_id: LISTING_ID,
      p_size_id: SIZE_ID,
    });
  });
});

describe("adminReactivateSize", () => {
  it("goes through the RPC and invalidates once", async () => {
    await expect(adminReactivateSize(LISTING_ID, SIZE_ID)).resolves.toEqual({});
    // The active-parent precondition is a predicate on the RPC's own UPDATE,
    // not a read before it, so nothing here reads the parent first.
    expect(mockRpc).toHaveBeenCalledWith("reactivate_size", {
      p_listing_id: LISTING_ID,
      p_size_id: SIZE_ID,
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("reports a size that matched no row", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "Size not found", code: "P0002" },
    });
    await expect(adminReactivateSize(LISTING_ID, SIZE_ID)).resolves.toEqual({
      error: "Size not found",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("names the parent status when the RPC refused on a non-active listing", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "Listing is not active", code: "55000" },
    });
    await expect(adminReactivateSize(LISTING_ID, SIZE_ID)).resolves.toEqual({
      error: "Reactivate the listing before changing its sizes",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("adminUpdateListing", () => {
  it("omits both image keys from the RPC payload so photos are never touched", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { status: "suspended" }, error: null }),
    );

    await expect(
      adminUpdateListing(LISTING_ID, formDataFor()),
    ).resolves.toEqual({});

    const [name, args] = mockRpc.mock.calls[0];
    expect(name).toBe("update_listing_with_variants");
    expect(args.p_listing_id).toBe(LISTING_ID);
    // Absent, not an empty array: the RPC preserves the row's own current
    // arrays only when the key is missing entirely (migration 033). Passing
    // an empty array here would wipe every photo instead.
    expect(args.p_listing).not.toHaveProperty("image_urls");
    expect(args.p_listing).not.toHaveProperty("image_blur_data_urls");
    // Editing is never an implicit status change; the RPC ignores it anyway.
    expect(args.p_listing.status).toBe("suspended");
  });

  it("ignores image fields submitted in the form", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { status: "active" }, error: null }),
    );

    const formData = formDataFor();
    formData.set("image_urls", JSON.stringify(["https://evil.example/x.webp"]));

    await adminUpdateListing(LISTING_ID, formData);
    expect(mockRpc.mock.calls[0][1].p_listing).not.toHaveProperty("image_urls");
  });

  it("edits a listing in any status", async () => {
    for (const status of [
      "active",
      "sold",
      "removed",
      "pending_payment",
      "suspended",
    ]) {
      vi.clearAllMocks();
      allowAdmin();
      mockRpc.mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() =>
        tableStub({
          data: { status, image_urls: [IMAGE_URL], image_blur_data_urls: [""] },
          error: null,
        }),
      );

      await expect(
        adminUpdateListing(LISTING_ID, formDataFor()),
        status,
      ).resolves.toEqual({});
    }
  });

  it("returns the form's own message for invalid input and calls no RPC", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({
        data: { status: "active", image_urls: [IMAGE_URL], image_blur_data_urls: [""] },
        error: null,
      }),
    );

    const result = await adminUpdateListing(
      LISTING_ID,
      formDataFor({ title: "no" }),
    );
    expect(result.error).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("reports a missing listing without calling the RPC", async () => {
    mockFrom.mockImplementation(() => tableStub({ data: null, error: null }));
    await expect(
      adminUpdateListing(LISTING_ID, formDataFor()),
    ).resolves.toEqual({ error: "Listing not found" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("keeps the operator's field message for a validation failure", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({
        data: {
          status: "active",
          image_urls: [IMAGE_URL],
          image_blur_data_urls: [""],
        },
        error: null,
      }),
    );

    // The zod branch is the one an operator needs to read: it names the field.
    await expect(
      adminUpdateListing(LISTING_ID, formDataFor({ sell_mode: "set_only" })),
    ).resolves.toEqual({ error: "Set pricing requires at least two sizes." });
  });

  it("never puts a thrown database message on the operator's screen", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockImplementation(() => {
      throw new Error('relation "listings" does not exist');
    });

    const result = await adminUpdateListing(LISTING_ID, formDataFor());

    expect(result).toEqual({ error: UNEXPECTED_ERROR });
    expect(JSON.stringify(result)).not.toContain("relation");
    expect(mockUpdateTag).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("adminRemoveListingImage", () => {
  it("rewrites the arrays before deleting the object", async () => {
    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({});
    expect(calls).toEqual([
      "rpc:admin_remove_listing_image",
      "storage:delete",
    ]);
  });

  it("hands the RPC the URL and lets the database resolve the index", async () => {
    await adminRemoveListingImage(LISTING_ID, IMAGE_URL);
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
      "admin_remove_listing_image",
      { p_listing_id: LISTING_ID, p_image_url: IMAGE_URL },
    );
  });

  it("deletes only the URL it was given, never a client-supplied path", async () => {
    await adminRemoveListingImage(LISTING_ID, IMAGE_URL);
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [IMAGE_URL],
      SUPABASE,
    );
  });

  it("keeps the object when the committed array still references it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: [IMAGE_URL, NEW_IMAGE_URL], error: null });

    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({});
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // The deploy gap: the app ships before migration 036, so the older
  // void-returning function answers and nothing can prove the URL is gone.
  it("keeps the object when the write returned no array at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({});
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("never touches storage when the database write failed", async () => {
    mockRpc.mockResolvedValue({ error: { message: "boom", code: "P0002" } });
    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("reports the last-photo refusal in the operator's words", async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'violates check constraint', code: "23514" },
    });
    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "A listing must keep at least one photo." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
  });

  it("rejects a URL that is not a URL, before any call", async () => {
    await expect(
      adminRemoveListingImage(LISTING_ID, "../../secret.webp"),
    ).resolves.toEqual({ error: "Invalid image" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("still succeeds and invalidates when the storage delete fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    await expect(
      adminRemoveListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({});
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("adminReprocessListingImage", () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { image_urls: [IMAGE_URL] }, error: null }),
    );
  });

  it("uploads the new object before the row commits, and drops the old one after", async () => {
    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ notice: "Photo reprocessed. 1 face blurred." });

    expect(calls).toEqual([
      "storage:download",
      "pipeline",
      "storage:upload",
      "rpc:admin_replace_listing_image",
      "storage:delete",
    ]);
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [IMAGE_URL],
      SUPABASE,
    );
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("hands the RPC both URLs and the regenerated placeholder", async () => {
    await adminReprocessListingImage(LISTING_ID, IMAGE_URL);

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
      "admin_replace_listing_image",
      {
        p_listing_id: LISTING_ID,
        p_old_url: IMAGE_URL,
        p_new_url: NEW_IMAGE_URL,
        p_new_blur: "data:image/jpeg;base64,tiny",
        p_audit_action: "listing.image_reprocess",
      },
    );
  });

  it("uploads the processed bytes as webp, never the original content type", async () => {
    await adminReprocessListingImage(LISTING_ID, IMAGE_URL);

    expect(mockUploadListingImage).toHaveBeenCalledExactlyOnceWith({
      supabase: expect.anything(),
      body: Buffer.from("reprocessed"),
      contentType: "image/webp",
      // The admin prefix is what lets the seller delete this object later.
      listingId: LISTING_ID,
    });
  });

  it("pluralizes the face count", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 3,
      visionOk: true,
    });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ notice: "Photo reprocessed. 3 faces blurred." });
  });

  it("commits and says so when detection ran but found no face", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: true,
    });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ notice: "Photo reprocessed. No faces were detected." });
    expect(mockRpc).toHaveBeenCalledOnce();
  });

  it("refuses before any write when face detection could not run", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: false,
    });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({
      error: "Face detection is unavailable right now. Try again later.",
    });
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("deletes the freshly uploaded object when the row write fails", async () => {
    mockRpc.mockResolvedValue({ error: { message: "boom", code: "P0002" } });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [NEW_IMAGE_URL],
      SUPABASE,
    );
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("keeps the upload when the RPC failure carries no code, since it may have committed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "TypeError: fetch failed", code: "" } });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("logs rather than swallows a failed rollback delete", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "boom", code: "P0002" } });
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the mapped error when the rollback delete itself rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "boom", code: "P0002" } });
    mockDeleteListingImages.mockRejectedValue(new Error("network"));

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("maps an unexpected RPC code through the shared mapper", async () => {
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "42501" } });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Not authorized" });
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [NEW_IMAGE_URL],
      SUPABASE,
    );
  });

  it("stops when the URL is no longer on the listing", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { image_urls: [NEW_IMAGE_URL] }, error: null }),
    );

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockDownloadListingImage).not.toHaveBeenCalled();
  });

  it("stops when the listing does not exist", async () => {
    mockFrom.mockImplementation(() => tableStub({ data: null, error: null }));

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "Listing not found" });
    expect(mockDownloadListingImage).not.toHaveBeenCalled();
  });

  it("reports a pipeline failure without touching storage or the row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessListingImage.mockRejectedValue(new Error("unsupported format"));

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "This photo could not be processed." });
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("reports an upload failure without touching the row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadListingImage.mockRejectedValue(new Error("bucket full"));

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ error: "The reprocessed photo could not be saved." });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("rejects a malformed URL before reading the listing", async () => {
    await expect(
      adminReprocessListingImage(LISTING_ID, "../../secret.webp"),
    ).resolves.toEqual({ error: "Invalid image" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("still succeeds when deleting the replaced object fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    await expect(
      adminReprocessListingImage(LISTING_ID, IMAGE_URL),
    ).resolves.toEqual({ notice: "Photo reprocessed. 1 face blurred." });
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("RPC error mapping", () => {
  it("maps P0002 to not found and 42501 to not authorized", async () => {
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "P0002" } });
    await expect(adminRestoreListing(LISTING_ID)).resolves.toEqual({
      error: "Listing not found",
    });

    mockRpc.mockResolvedValue({ error: { message: "raw", code: "42501" } });
    await expect(adminRestoreListing(LISTING_ID)).resolves.toEqual({
      error: "Not authorized",
    });
  });

  it("says 'Size not found' rather than 'Listing not found' for a per-size call", async () => {
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "P0002" } });
    await expect(adminMarkSizeSold(LISTING_ID, SIZE_ID)).resolves.toEqual({
      error: "Size not found",
    });
  });

  it("never leaks raw database text for an unmapped code", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      error: { message: "duplicate key value violates ...", code: "23505" },
    });

    await expect(adminMarkListingSold(LISTING_ID)).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("invalidates nothing when the RPC failed", async () => {
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "42501" } });
    await adminSuspendListing(LISTING_ID, { slug: "spam" });
    await adminRestoreListing(LISTING_ID);
    await adminRemoveListing(LISTING_ID);
    await adminMarkListingSold(LISTING_ID);
    await adminReactivateListing(LISTING_ID);
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("adminReplaceListingImage", () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { image_urls: [IMAGE_URL] }, error: null }),
    );
  });

  it("uploads the replacement first and only then drops the old object", async () => {
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 1 face blurred." });

    expect(calls).toEqual([
      "pipeline",
      "storage:upload",
      "rpc:admin_replace_listing_image",
      "storage:delete",
    ]);
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("logs a replace, never a reprocess", async () => {
    await adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm());

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
      "admin_replace_listing_image",
      {
        p_listing_id: LISTING_ID,
        p_old_url: IMAGE_URL,
        p_new_url: NEW_IMAGE_URL,
        p_new_blur: "data:image/jpeg;base64,tiny",
        p_audit_action: "listing.image_replace",
      },
    );
  });

  it("uploads under the listing's admin prefix, as webp", async () => {
    await adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm());

    expect(mockUploadListingImage).toHaveBeenCalledExactlyOnceWith({
      supabase: expect.anything(),
      body: Buffer.from("reprocessed"),
      contentType: "image/webp",
      listingId: LISTING_ID,
    });
  });

  it("hands the cleanup the authorized client", async () => {
    await adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm());
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [IMAGE_URL],
      SUPABASE,
    );
  });

  it("reports the face count for zero, one, and many", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: true,
    });
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. No faces were detected." });

    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 2,
      visionOk: true,
    });
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 2 faces blurred." });
  });

  it("refuses with no file at all", async () => {
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, new FormData()),
    ).resolves.toEqual({ error: "Choose a photo." });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("refuses a file type sharp cannot decode", async () => {
    const heic = new File([new Uint8Array([1])], "gown.heic", {
      type: "image/heic",
    });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm(heic)),
    ).resolves.toEqual({ error: "Upload a JPEG, PNG, or WebP image." });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("refuses an empty file and an oversized one", async () => {
    const empty = new File([], "gown.jpg", { type: "image/jpeg" });
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm(empty)),
    ).resolves.toEqual({ error: "Keep the photo under 25 MB." });

    const huge = new File(
      [new Uint8Array(25 * 1024 * 1024 + 1)],
      "gown.jpg",
      { type: "image/jpeg" },
    );
    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm(huge)),
    ).resolves.toEqual({ error: "Keep the photo under 25 MB." });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("stops before the pipeline when the photo is no longer on the listing", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { image_urls: [NEW_IMAGE_URL] }, error: null }),
    );

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("stops when the listing does not exist", async () => {
    mockFrom.mockImplementation(() => tableStub({ data: null, error: null }));

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "Listing not found" });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("leaves the old photo alone when the pipeline throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessListingImage.mockRejectedValue(new Error("unsupported"));

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "This photo could not be processed." });
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("leaves the old photo alone when face detection could not run", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: false,
    });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({
      error: "Face detection is unavailable right now. Try again later.",
    });
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
  });

  // The hard constraint the whole feature exists for.
  it("never deletes the old object when the upload failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadListingImage.mockRejectedValue(new Error("bucket full"));

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "The replacement photo could not be saved." });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("deletes the fresh upload when the database refused, and keeps the old one", async () => {
    mockRpc.mockResolvedValue({ error: { message: "boom", code: "P0002" } });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [NEW_IMAGE_URL],
      SUPABASE,
    );
  });

  it("keeps the fresh upload when the failure carries no code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      error: { message: "TypeError: fetch failed", code: "" },
    });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not surface suspend's reason copy for a rejected audit slug", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "22023" } });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ error: "Something went wrong. Please try again." });
    warn.mockRestore();
  });

  it("keeps the old object when the committed array still references it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      data: [NEW_IMAGE_URL, IMAGE_URL],
      error: null,
    });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 1 face blurred." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the old object when the swap returned no array at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 1 face blurred." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("still succeeds when the cleanup returns an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 1 face blurred." });
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("still succeeds when the cleanup itself rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteListingImages.mockRejectedValue(new Error("network"));

    await expect(
      adminReplaceListingImage(LISTING_ID, IMAGE_URL, photoForm()),
    ).resolves.toEqual({ notice: "Photo replaced. 1 face blurred." });
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("rejects a malformed URL before reading the listing", async () => {
    await expect(
      adminReplaceListingImage(LISTING_ID, "../../secret.webp", photoForm()),
    ).resolves.toEqual({ error: "Invalid image" });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("adminAddListingImage", () => {
  beforeEach(() => {
    mockFrom.mockImplementation(() =>
      tableStub({ data: { image_urls: [IMAGE_URL] }, error: null }),
    );
  });

  it("appends after the upload and deletes nothing", async () => {
    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ notice: "Photo added. 1 face blurred." });

    expect(calls).toEqual([
      "pipeline",
      "storage:upload",
      "rpc:admin_append_listing_image",
    ]);
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("hands the RPC the new URL and its placeholder", async () => {
    await adminAddListingImage(LISTING_ID, photoForm());

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
      "admin_append_listing_image",
      {
        p_listing_id: LISTING_ID,
        p_new_url: NEW_IMAGE_URL,
        p_new_blur: "data:image/jpeg;base64,tiny",
      },
    );
  });

  it("refuses at three photos before the pipeline costs anything", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({
        data: { image_urls: [IMAGE_URL, NEW_IMAGE_URL, "https://x/c.webp"] },
        error: null,
      }),
    );

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ error: "A listing can hold at most three photos." });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reports the database's own refusal at three in the same words", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "at most three", code: "23514" },
    });

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ error: "A listing can hold at most three photos." });
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith(
      [NEW_IMAGE_URL],
      SUPABASE,
    );
  });

  it("refuses an invalid listing id before anything else", async () => {
    await expect(adminAddListingImage("nope", photoForm())).resolves.toEqual({
      error: "Invalid listing id",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong-type file", async () => {
    await expect(
      adminAddListingImage(LISTING_ID, new FormData()),
    ).resolves.toEqual({ error: "Choose a photo." });

    const gif = new File([new Uint8Array([1])], "a.gif", { type: "image/gif" });
    await expect(
      adminAddListingImage(LISTING_ID, photoForm(gif)),
    ).resolves.toEqual({ error: "Upload a JPEG, PNG, or WebP image." });
    expect(mockProcessListingImage).not.toHaveBeenCalled();
  });

  it("writes nothing when face detection could not run", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: false,
    });

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({
      error: "Face detection is unavailable right now. Try again later.",
    });
    expect(mockUploadListingImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reports an upload failure without touching the row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUploadListingImage.mockRejectedValue(new Error("bucket full"));

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ error: "The photo could not be saved." });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("keeps the upload when the append failure carries no code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      error: { message: "TypeError: fetch failed", code: "" },
    });

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("says nothing about a face when none was found", async () => {
    mockProcessListingImage.mockResolvedValue({
      webp: Buffer.from("reprocessed"),
      facesDetected: 0,
      visionOk: true,
    });

    await expect(
      adminAddListingImage(LISTING_ID, photoForm()),
    ).resolves.toEqual({ notice: "Photo added. No faces were detected." });
  });
});

describe("adminMoveListingImage", () => {
  it("addresses the photo by position AND by the URL the page believes is there", async () => {
    await expect(
      adminMoveListingImage(LISTING_ID, 2, IMAGE_URL, -1),
    ).resolves.toEqual({});

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_move_listing_image", {
      p_listing_id: LISTING_ID,
      p_index: 2,
      p_expected_url: IMAGE_URL,
      p_offset: -1,
    });
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("touches storage on no path at all", async () => {
    await adminMoveListingImage(LISTING_ID, 1, IMAGE_URL, 1);
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUploadListingImage).not.toHaveBeenCalled();
  });

  it("refuses an offset that is not one step", async () => {
    await expect(
      adminMoveListingImage(LISTING_ID, 1, IMAGE_URL, 2),
    ).resolves.toEqual({ error: "Invalid move" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses a position outside the array bounds", async () => {
    await expect(
      adminMoveListingImage(LISTING_ID, 0, IMAGE_URL, 1),
    ).resolves.toEqual({ error: "Invalid move" });
    await expect(
      adminMoveListingImage(LISTING_ID, 4, IMAGE_URL, 1),
    ).resolves.toEqual({ error: "Invalid move" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses a malformed listing id or image URL", async () => {
    await expect(
      adminMoveListingImage("nope", 1, IMAGE_URL, 1),
    ).resolves.toEqual({ error: "Invalid move" });
    await expect(
      adminMoveListingImage(LISTING_ID, 1, "../../secret.webp", 1),
    ).resolves.toEqual({ error: "Invalid move" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("says the page is stale rather than repeating suspend's reason copy", async () => {
    mockRpc.mockResolvedValue({ error: { message: "raw", code: "22023" } });
    await expect(
      adminMoveListingImage(LISTING_ID, 1, IMAGE_URL, -1),
    ).resolves.toEqual({
      error: "That move is no longer possible. Refresh the page.",
    });

    mockRpc.mockResolvedValue({ error: { message: "raw", code: "P0002" } });
    await expect(
      adminMoveListingImage(LISTING_ID, 1, IMAGE_URL, 1),
    ).resolves.toEqual({ error: "Photo not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
