import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthClient, mockGetUserWishlist } = vi.hoisted(() => ({
  mockGetAuthClient: vi.fn(),
  mockGetUserWishlist: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockGetAuthClient }));
vi.mock("@/lib/queries/wishlist", () => ({
  getUserWishlist: mockGetUserWishlist,
}));

import {
  addToWishlist,
  mergeWishlist,
  removeFromWishlist,
} from "@/lib/actions/wishlist";

import type { WishlistItem, WishlistSnapshot } from "@/lib/types";

const USER_ID = "99999999-9999-9999-9999-999999999999";
const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";

const SNAPSHOT: WishlistSnapshot = {
  title: "Gown",
  priceLabel: "$400",
  image: "https://example.com/a.jpg",
  blurDataUrl: null,
};

type Result = { data?: unknown; error: null | { message: string } };

function makeSupabase(options: {
  upsertResult?: Result;
  deleteResult?: Result;
  rpcResult?: Result;
} = {}) {
  const {
    upsertResult = { error: null },
    deleteResult = { error: null },
    rpcResult = { data: [], error: null },
  } = options;

  const chain = {
    upsert: vi.fn().mockResolvedValue(upsertResult),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: Result) => unknown) => resolve(deleteResult),
  };
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc,
    _chain: chain,
    _rpc: rpc,
  };
}

function authOk(supabase: ReturnType<typeof makeSupabase>) {
  mockGetAuthClient.mockResolvedValue({
    ok: true,
    supabase,
    user: { id: USER_ID },
  });
}

const canonical: WishlistItem[] = [
  { listingId: ID_A, addedAt: "2026-07-01T00:00:00.000Z", status: "active", snapshot: SNAPSHOT },
];

beforeEach(() => {
  mockGetAuthClient.mockReset();
  mockGetUserWishlist.mockReset();
  mockGetUserWishlist.mockResolvedValue(canonical);
});

describe("addToWishlist", () => {
  it("rejects an invalid listing id without touching auth", async () => {
    const result = await addToWishlist("not-a-uuid", SNAPSHOT);

    expect(result).toEqual({ success: false, error: "Invalid wishlist item." });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when not authenticated", async () => {
    mockGetAuthClient.mockResolvedValue({ ok: false, error: "Not authenticated" });

    const result = await addToWishlist(ID_A, SNAPSHOT);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("upserts with conflict-ignore on the composite key", async () => {
    const supabase = makeSupabase();
    authOk(supabase);

    const result = await addToWishlist(ID_A, SNAPSHOT);

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("wishlist_items");
    expect(supabase._chain.upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, listing_id: ID_A, snapshot: SNAPSHOT },
      { onConflict: "user_id,listing_id", ignoreDuplicates: true },
    );
  });

  it("returns an error when the upsert fails", async () => {
    const supabase = makeSupabase({ upsertResult: { error: { message: "boom" } } });
    authOk(supabase);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await addToWishlist(ID_A, SNAPSHOT);

    expect(result.success).toBe(false);
    consoleError.mockRestore();
  });
});

describe("removeFromWishlist", () => {
  it("rejects an invalid listing id", async () => {
    const result = await removeFromWishlist("nope");

    expect(result).toEqual({ success: false, error: "Invalid listing id." });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("deletes the owner's row for the listing", async () => {
    const supabase = makeSupabase();
    authOk(supabase);

    const result = await removeFromWishlist(ID_A);

    expect(result).toEqual({ success: true });
    expect(supabase._chain.delete).toHaveBeenCalled();
    expect(supabase._chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabase._chain.eq).toHaveBeenCalledWith("listing_id", ID_A);
  });

  it("returns an error when the delete fails", async () => {
    const supabase = makeSupabase({ deleteResult: { error: { message: "boom" } } });
    authOk(supabase);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await removeFromWishlist(ID_A);

    expect(result.success).toBe(false);
    consoleError.mockRestore();
  });
});

describe("mergeWishlist", () => {
  it("rejects when an item has an invalid listing id", async () => {
    const result = await mergeWishlist([
      { listingId: "bad", snapshot: SNAPSHOT },
    ]);

    expect(result).toEqual({ success: false, error: "Invalid wishlist data." });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("rejects when over the item cap", async () => {
    const items = Array.from({ length: 51 }, () => ({
      listingId: crypto.randomUUID(),
      snapshot: SNAPSHOT,
    }));

    const result = await mergeWishlist(items);

    expect(result).toEqual({ success: false, error: "Invalid wishlist data." });
  });

  it("returns the canonical list without upserting when there are no local items", async () => {
    const supabase = makeSupabase();
    authOk(supabase);

    const result = await mergeWishlist([]);

    expect(result).toEqual({ success: true, items: canonical });
    expect(supabase._chain.upsert).not.toHaveBeenCalled();
    expect(supabase._rpc).not.toHaveBeenCalled();
  });

  it("drops hard-deleted ids and upserts only existing rows", async () => {
    const supabase = makeSupabase({ rpcResult: { data: [ID_A], error: null } });
    authOk(supabase);

    const result = await mergeWishlist([
      { listingId: ID_A, snapshot: SNAPSHOT },
      { listingId: ID_B, snapshot: SNAPSHOT },
    ]);

    expect(supabase._rpc).toHaveBeenCalledWith("existing_listing_ids", {
      p_ids: [ID_A, ID_B],
    });
    expect(supabase._chain.upsert).toHaveBeenCalledWith(
      [{ user_id: USER_ID, listing_id: ID_A, snapshot: SNAPSHOT }],
      { onConflict: "user_id,listing_id", ignoreDuplicates: true },
    );
    expect(result).toEqual({ success: true, items: canonical });
  });

  it("skips the upsert when every local id is hard-deleted", async () => {
    const supabase = makeSupabase({ rpcResult: { data: [], error: null } });
    authOk(supabase);

    const result = await mergeWishlist([{ listingId: ID_A, snapshot: SNAPSHOT }]);

    expect(supabase._chain.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, items: canonical });
  });

  it("returns an error when the existence check fails", async () => {
    const supabase = makeSupabase({ rpcResult: { data: null, error: { message: "boom" } } });
    authOk(supabase);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await mergeWishlist([{ listingId: ID_A, snapshot: SNAPSHOT }]);

    expect(result.success).toBe(false);
    consoleError.mockRestore();
  });

  it("returns an error when the merge upsert fails", async () => {
    const supabase = makeSupabase({
      rpcResult: { data: [ID_A], error: null },
      upsertResult: { error: { message: "boom" } },
    });
    authOk(supabase);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await mergeWishlist([{ listingId: ID_A, snapshot: SNAPSHOT }]);

    expect(result.success).toBe(false);
    consoleError.mockRestore();
  });

  it("returns an error when loading the canonical list throws", async () => {
    const supabase = makeSupabase();
    authOk(supabase);
    mockGetUserWishlist.mockRejectedValue(new Error("boom"));

    const result = await mergeWishlist([]);

    expect(result.success).toBe(false);
  });
});
