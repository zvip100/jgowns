import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminActionClient,
  mockUpdateTag,
  mockRpc,
  mockFrom,
  mockDeleteListingImages,
  mockGetUserById,
  mockUpdateUserById,
  mockDeleteUser,
  calls,
} = vi.hoisted(() => ({
  mockGetAdminActionClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockDeleteListingImages: vi.fn(),
  mockGetUserById: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockDeleteUser: vi.fn(),
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
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        getUserById: mockGetUserById,
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
      },
    },
  }),
}));

import {
  adminBanUser,
  adminDeleteUser,
  adminUnbanUser,
} from "@/lib/actions/admin/users";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LISTING_A = "11111111-1111-4111-8111-111111111111";
const LISTING_B = "22222222-2222-4222-8222-222222222222";
const IMAGE_A =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/a.webp";
const IMAGE_B =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/b.webp";

function listingsStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => {
    calls.push("read:listings");
    return chain;
  });
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

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  allowAdmin();

  mockGetUserById.mockImplementation(async () => {
    calls.push("auth:getUserById");
    return { data: { user: { id: USER_ID, email: "seller@example.com" } } };
  });
  mockUpdateUserById.mockImplementation(async () => {
    calls.push("auth:updateUserById");
    return { error: null };
  });
  mockDeleteUser.mockImplementation(async () => {
    calls.push("auth:deleteUser");
    return { error: null };
  });
  mockRpc.mockImplementation(async (name: string) => {
    calls.push(`rpc:${name}`);
    if (name === "admin_suspend_seller_listings") {
      return { data: [LISTING_A, LISTING_B], error: null };
    }
    return { data: null, error: null };
  });
  mockFrom.mockImplementation(() =>
    listingsStub({
      data: [
        { id: LISTING_A, image_urls: [IMAGE_A] },
        { id: LISTING_B, image_urls: [IMAGE_B] },
      ],
      error: null,
    }),
  );
  mockDeleteListingImages.mockImplementation(async () => {
    calls.push("storage:delete");
    return { ok: true };
  });
});

const ALL_ACTIONS: [string, () => Promise<{ error?: string }>][] = [
  ["adminBanUser", () => adminBanUser(USER_ID)],
  ["adminUnbanUser", () => adminUnbanUser(USER_ID)],
  ["adminDeleteUser", () => adminDeleteUser(USER_ID)],
];

describe("admin user actions: guard", () => {
  it("returns the guard's error and touches neither GoTrue nor the database", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      mockGetAdminActionClient.mockResolvedValue({
        ok: false,
        error: "Not authorized",
      });

      await expect(run(), name).resolves.toEqual({ error: "Not authorized" });
      expect(mockUpdateUserById, name).not.toHaveBeenCalled();
      expect(mockDeleteUser, name).not.toHaveBeenCalled();
      expect(mockRpc, name).not.toHaveBeenCalled();
      expect(mockUpdateTag, name).not.toHaveBeenCalled();
    }
  });

  it("refuses a demo-mode request before any auth call", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      mockGetAdminActionClient.mockResolvedValue({
        ok: false,
        error: "Turn off demo mode to make changes.",
      });

      await expect(run(), name).resolves.toEqual({
        error: "Turn off demo mode to make changes.",
      });
      expect(mockUpdateUserById, name).not.toHaveBeenCalled();
      expect(mockDeleteUser, name).not.toHaveBeenCalled();
    }
  });

  it("rejects a malformed user id before any call", async () => {
    for (const [name, run] of [
      ["ban", () => adminBanUser("user-1")],
      ["unban", () => adminUnbanUser("user-1")],
      ["delete", () => adminDeleteUser("user-1")],
    ] as const) {
      vi.clearAllMocks();
      allowAdmin();
      await expect(run(), name).resolves.toEqual({ error: "Invalid user id" });
      expect(mockUpdateUserById, name).not.toHaveBeenCalled();
      expect(mockDeleteUser, name).not.toHaveBeenCalled();
    }
  });
});

describe("adminBanUser", () => {
  it("bans with the indefinite duration and sweeps by default", async () => {
    await expect(adminBanUser(USER_ID)).resolves.toEqual({});
    expect(mockUpdateUserById).toHaveBeenCalledExactlyOnceWith(USER_ID, {
      ban_duration: "876000h",
    });
    expect(mockRpc).toHaveBeenCalledWith("admin_suspend_seller_listings", {
      p_user_id: USER_ID,
      p_slug: "other",
      p_note: "The seller account was banned.",
    });
  });

  it("bans before it sweeps, and logs only after both land", async () => {
    await adminBanUser(USER_ID);
    expect(calls).toEqual([
      "auth:getUserById",
      "auth:updateUserById",
      "rpc:admin_suspend_seller_listings",
      "rpc:admin_log_event",
    ]);
  });

  it("invalidates one tag per swept listing plus the collection, once", async () => {
    await adminBanUser(USER_ID);
    expect(mockUpdateTag.mock.calls).toEqual([
      [`listing:${LISTING_A}`],
      [`listing:${LISTING_B}`],
      ["listings"],
    ]);
  });

  it("invalidates nothing when the sweep is declined: no listing changed", async () => {
    await expect(adminBanUser(USER_ID, { sweepListings: false })).resolves.toEqual(
      {},
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      "admin_suspend_seller_listings",
      expect.anything(),
    );
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("invalidates nothing when a requested sweep found no active listings", async () => {
    mockRpc.mockImplementation(async (name: string) => {
      calls.push(`rpc:${name}`);
      return { data: [], error: null };
    });
    await expect(adminBanUser(USER_ID)).resolves.toEqual({});
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("logs user.ban on the operator's own client, against the target's email", async () => {
    await adminBanUser(USER_ID);
    expect(mockRpc).toHaveBeenCalledWith("admin_log_event", {
      p_action: "user.ban",
      p_entity_type: "user",
      p_entity_id: USER_ID,
      p_entity_label: "seller@example.com",
      p_reason: "2 active listings suspended",
    });
  });

  it("reports a partial failure when the ban lands but the sweep does not", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockImplementation(async (name: string) => {
      calls.push(`rpc:${name}`);
      if (name === "admin_suspend_seller_listings") {
        return { data: null, error: { message: "sweep failed" } };
      }
      return { data: null, error: null };
    });

    const result = await adminBanUser(USER_ID);
    expect(result.error).toContain("banned");
    expect(result.error).toContain("listings could not be suspended");
    expect(mockUpdateTag).not.toHaveBeenCalled();
    // The ban still happened, so it is still recorded.
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_log_event",
      expect.objectContaining({ p_action: "user.ban" }),
    );
    error.mockRestore();
  });

  it("does not sweep or log when the ban itself failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateUserById.mockResolvedValue({ error: { message: "gotrue down" } });

    const result = await adminBanUser(USER_ID);
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not leak GoTrue's message to the client", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateUserById.mockResolvedValue({
      error: { message: "connection refused at 10.0.0.4:5432" },
    });
    const result = await adminBanUser(USER_ID);
    expect(result.error).not.toContain("10.0.0.4");
    error.mockRestore();
  });

  it("still succeeds when only the audit write fails: the ban already happened", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "admin_log_event") return { error: { message: "log down" } };
      return { data: [LISTING_A], error: null };
    });

    await expect(adminBanUser(USER_ID)).resolves.toEqual({});
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("adminUnbanUser", () => {
  it("lifts the ban and logs it, invalidating nothing", async () => {
    await expect(adminUnbanUser(USER_ID)).resolves.toEqual({});
    expect(mockUpdateUserById).toHaveBeenCalledExactlyOnceWith(USER_ID, {
      ban_duration: "none",
    });
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_log_event", {
      p_action: "user.unban",
      p_entity_type: "user",
      p_entity_id: USER_ID,
      p_entity_label: "seller@example.com",
      p_reason: null,
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("logs only after the auth call succeeded", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateUserById.mockResolvedValue({ error: { message: "nope" } });

    const result = await adminUnbanUser(USER_ID);
    expect(result.error).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("adminDeleteUser", () => {
  it("collects the email, listing ids, and image urls before deleting", async () => {
    await expect(adminDeleteUser(USER_ID)).resolves.toEqual({});
    expect(calls).toEqual([
      "auth:getUserById",
      "read:listings",
      "auth:deleteUser",
      "rpc:admin_log_event",
      "storage:delete",
    ]);
  });

  it("sweeps every collected image url, which no foreign key would cascade", async () => {
    await adminDeleteUser(USER_ID);
    expect(mockDeleteListingImages).toHaveBeenCalledExactlyOnceWith([
      IMAGE_A,
      IMAGE_B,
    ]);
  });

  it("invalidates one tag per collected listing plus the collection", async () => {
    await adminDeleteUser(USER_ID);
    expect(mockUpdateTag.mock.calls).toEqual([
      [`listing:${LISTING_A}`],
      [`listing:${LISTING_B}`],
      ["listings"],
    ]);
  });

  it("logs user.delete with the email captured before the account vanished", async () => {
    await adminDeleteUser(USER_ID);
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_log_event", {
      p_action: "user.delete",
      p_entity_type: "user",
      p_entity_id: USER_ID,
      p_entity_label: "seller@example.com",
      p_reason: "2 listings removed with the account",
    });
  });

  it("does not delete the account when the pre-delete collection failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFrom.mockImplementation(() =>
      listingsStub({ data: null, error: { message: "read failed" } }),
    );

    const result = await adminDeleteUser(USER_ID);
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(mockDeleteUser).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("does nothing after a failed delete: no audit row, no sweep, no invalidation", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeleteUser.mockResolvedValue({ error: { message: "gotrue down" } });

    const result = await adminDeleteUser(USER_ID);
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("still reports success when the storage sweep fails: the account is gone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    await expect(adminDeleteUser(USER_ID)).resolves.toEqual({});
    expect(mockUpdateTag).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("skips storage and invalidation for a seller who had no listings", async () => {
    mockFrom.mockImplementation(() => listingsStub({ data: [], error: null }));

    await expect(adminDeleteUser(USER_ID)).resolves.toEqual({});
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_log_event",
      expect.objectContaining({ p_reason: null }),
    );
  });

  it("still succeeds when only the audit write fails: the delete is irreversible", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "log down" } });

    await expect(adminDeleteUser(USER_ID)).resolves.toEqual({});
    expect(mockDeleteListingImages).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("admin user actions: the identity read fails closed", () => {
  it("does not ban, unban, or delete when the target read errored", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      allowAdmin();
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetUserById.mockResolvedValue({
        data: { user: null },
        error: { message: "network" },
      });

      await expect(run(), name).resolves.toEqual({ error: UNEXPECTED_ERROR });
      expect(mockUpdateUserById, name).not.toHaveBeenCalled();
      expect(mockDeleteUser, name).not.toHaveBeenCalled();
      expect(mockRpc, name).not.toHaveBeenCalled();
      expect(mockUpdateTag, name).not.toHaveBeenCalled();
      expect(logged, name).toHaveBeenCalled();
      logged.mockRestore();
    }
  });

  it("stops on a target that no longer exists rather than acting on an empty label", async () => {
    for (const [name, run] of ALL_ACTIONS) {
      vi.clearAllMocks();
      allowAdmin();
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetUserById.mockResolvedValue({ data: { user: null }, error: null });

      await expect(run(), name).resolves.toEqual({ error: UNEXPECTED_ERROR });
      expect(mockDeleteUser, name).not.toHaveBeenCalled();
      logged.mockRestore();
    }
  });

  it("proceeds with an empty label when the account exists but has no email", async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { id: USER_ID, email: null } },
      error: null,
    });

    await expect(adminUnbanUser(USER_ID)).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_log_event",
      expect.objectContaining({ p_entity_label: "" }),
    );
  });
});

describe("adminBanUser: options are validated, never read raw", () => {
  it("returns a typed error instead of throwing when options is null", async () => {
    // A server action is an independently callable endpoint: a replayed request
    // can send anything, and `options.sweepListings` on null would reject the
    // promise at the client instead of returning a result.
    await expect(
      adminBanUser(USER_ID, null as unknown as undefined),
    ).resolves.toEqual({});
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_suspend_seller_listings",
      expect.anything(),
    );
  });

  it("sweeps by default when the flag is omitted entirely", async () => {
    await expect(adminBanUser(USER_ID)).resolves.toEqual({});
    expect(calls).toContain("rpc:admin_suspend_seller_listings");
  });

  it("rejects a non-boolean flag rather than coercing it", async () => {
    await expect(
      adminBanUser(USER_ID, { sweepListings: "yes" } as unknown as {
        sweepListings?: boolean;
      }),
    ).resolves.toEqual({ error: "Invalid request" });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("ignores a forged userId smuggled in through the options object", async () => {
    const forged = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await adminBanUser(USER_ID, {
      userId: forged,
      sweepListings: false,
    } as unknown as { sweepListings?: boolean });

    expect(mockUpdateUserById).toHaveBeenCalledWith(USER_ID, expect.anything());
  });
});
