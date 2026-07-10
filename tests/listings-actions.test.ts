import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthClient, mockUpdateTag, mockRevalidateTag } = vi.hoisted(
  () => ({
    mockGetAuthClient: vi.fn(),
    mockUpdateTag: vi.fn(),
    mockRevalidateTag: vi.fn(),
  }),
);

vi.mock("next/cache", () => ({
  updateTag: mockUpdateTag,
  revalidateTag: mockRevalidateTag,
}));
vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockGetAuthClient }));

import {
  markListingSold,
  markSizeSold,
  reactivateListing,
  reactivateSize,
  removeListing,
  revalidateListings,
} from "@/lib/actions/listings";

const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SIZE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type UpdateResult = {
  data: { id: string }[] | null;
  error: null | { message: string };
};

function makeSupabase(
  sizesResult: UpdateResult = { data: [{ id: SIZE_ID }], error: null },
  rpcResult: { error: null | { message: string } } = { error: null },
  listingsResult: UpdateResult = { data: [{ id: LISTING_ID }], error: null },
) {
  const sizesChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(sizesResult),
  };
  const listingsChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(listingsResult),
  };
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  return {
    from: vi.fn((table: string) =>
      table === "listings" ? listingsChain : sizesChain,
    ),
    rpc,
    _listingsChain: listingsChain,
    _sizesChain: sizesChain,
    _rpc: rpc,
  };
}

beforeEach(() => {
  mockGetAuthClient.mockReset();
  mockUpdateTag.mockReset();
  mockRevalidateTag.mockReset();
});

describe("revalidateListings", () => {
  it("revalidates the listings tag", async () => {
    await revalidateListings();
    expect(mockRevalidateTag).toHaveBeenCalledWith("listings", "max");
  });
});

describe("markListingSold", () => {
  it("marks the listing and all its sizes sold, then invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markListingSold(LISTING_ID);

    expect(result).toEqual({});
    expect(supabase._rpc).toHaveBeenCalledWith("mark_listing_sold", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns an error for a blank id without touching the database", async () => {
    const result = await markListingSold("");
    expect(result).toEqual({ error: "Invalid listing id" });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when the user is not signed in", async () => {
    mockGetAuthClient.mockResolvedValue({
      ok: false,
      error: "Not authenticated",
    });
    const result = await markListingSold(LISTING_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns 'Listing not found' when no row matches", async () => {
    const supabase = makeSupabase(undefined, {
      error: { message: "Listing not found" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markListingSold(LISTING_ID);
    expect(result).toEqual({ error: "Listing not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("removeListing", () => {
  it("marks the listing removed, then invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({});
    expect(supabase.from).toHaveBeenCalledWith("listings");
    expect(supabase._listingsChain.update).toHaveBeenCalledWith({
      status: "removed",
    });
    expect(supabase._listingsChain.eq).toHaveBeenCalledWith("id", LISTING_ID);
    expect(supabase._listingsChain.eq).toHaveBeenCalledWith(
      "user_id",
      "user-1",
    );
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns an error for a blank id without touching the database", async () => {
    const result = await removeListing("");
    expect(result).toEqual({ error: "Invalid listing id" });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when the user is not signed in", async () => {
    mockGetAuthClient.mockResolvedValue({
      ok: false,
      error: "Not authenticated",
    });
    const result = await removeListing(LISTING_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns 'Listing not found' when no owner row matches", async () => {
    const supabase = makeSupabase(undefined, undefined, {
      data: [],
      error: null,
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await removeListing(LISTING_ID);
    expect(result).toEqual({ error: "Listing not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("markSizeSold", () => {
  it("marks the single size sold via the sync RPC and invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markSizeSold(LISTING_ID, SIZE_ID);

    expect(result).toEqual({});
    expect(supabase._rpc).toHaveBeenCalledWith("mark_size_sold", {
      p_listing_id: LISTING_ID,
      p_size_id: SIZE_ID,
    });
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns errors for blank ids without touching the database", async () => {
    expect(await markSizeSold("", SIZE_ID)).toEqual({
      error: "Invalid listing id",
    });
    expect(await markSizeSold(LISTING_ID, "")).toEqual({
      error: "Invalid size id",
    });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns 'Size not found' when the RPC reports no matching row", async () => {
    const supabase = makeSupabase(undefined, {
      error: { message: "Size not found" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markSizeSold(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Size not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("reactivateListing", () => {
  it("reactivates the listing and all its sizes, then invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateListing(LISTING_ID);

    expect(result).toEqual({});
    expect(supabase._rpc).toHaveBeenCalledWith("reactivate_listing", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns an error for a blank id without touching the database", async () => {
    const result = await reactivateListing("");
    expect(result).toEqual({ error: "Invalid listing id" });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when the user is not signed in", async () => {
    mockGetAuthClient.mockResolvedValue({
      ok: false,
      error: "Not authenticated",
    });
    const result = await reactivateListing(LISTING_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns 'Listing not found' when no row matches", async () => {
    const supabase = makeSupabase(undefined, {
      error: { message: "Listing not found" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateListing(LISTING_ID);
    expect(result).toEqual({ error: "Listing not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("reactivateSize", () => {
  it("marks the single size available and invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);

    expect(result).toEqual({});
    expect(supabase._sizesChain.update).toHaveBeenCalledWith({
      status: "available",
    });
    expect(supabase._sizesChain.eq).toHaveBeenCalledWith("id", SIZE_ID);
    expect(supabase._sizesChain.eq).toHaveBeenCalledWith(
      "listing_id",
      LISTING_ID,
    );
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("returns errors for blank ids without touching the database", async () => {
    expect(await reactivateSize("", SIZE_ID)).toEqual({
      error: "Invalid listing id",
    });
    expect(await reactivateSize(LISTING_ID, "")).toEqual({
      error: "Invalid size id",
    });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when the user is not signed in", async () => {
    mockGetAuthClient.mockResolvedValue({
      ok: false,
      error: "Not authenticated",
    });
    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns 'Size not found' when no row matches (wrong owner or id)", async () => {
    const supabase = makeSupabase({ data: [], error: null });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Size not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
