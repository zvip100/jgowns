import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminActionClient,
  mockUpdateTag,
  mockRpc,
  mockFrom,
  mockDeleteListingImages,
  calls,
} = vi.hoisted(() => ({
  mockGetAdminActionClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockDeleteListingImages: vi.fn(),
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

import {
  adminMarkListingSold,
  adminMarkSizeSold,
  adminReactivateListing,
  adminReactivateSize,
  adminRemoveListing,
  adminRemoveListingImage,
  adminRestoreListing,
  adminSuspendListing,
  adminUpdateListing,
} from "@/lib/actions/admin/listings";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const SIZE_ID = "22222222-2222-4222-8222-222222222222";
const IMAGE_URL =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/a.webp";

type MaybeError = { error: null | { message: string; code?: string } };

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
    supabase: { rpc: mockRpc, from: mockFrom },
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
    return { error: null } satisfies MaybeError;
  });
  mockFrom.mockImplementation(() =>
    tableStub({ data: { status: "active" }, error: null }),
  );
  mockDeleteListingImages.mockImplementation(async () => {
    calls.push("storage:delete");
    return { ok: true };
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
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith([IMAGE_URL]);
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
