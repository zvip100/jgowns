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
  revalidateListings,
} from "@/lib/actions/listings";

const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SIZE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type UpdateResult = {
  data: { id: string }[] | null;
  error: null | { message: string };
};

function makeSupabase(
  listingResult: UpdateResult = { data: [{ id: LISTING_ID }], error: null },
  sizesResult: UpdateResult = { data: [{ id: SIZE_ID }], error: null },
) {
  const listingChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(listingResult),
  };
  const sizesChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(sizesResult),
    then: undefined as unknown,
  };
  // markListingSold awaits the sizes update chain directly (no .select()).
  const sizesThenable = Object.assign(sizesChain, {
    then: (resolve: (v: UpdateResult) => unknown) =>
      Promise.resolve(sizesResult).then(resolve),
  });

  return {
    from: vi.fn().mockImplementation((table: string) =>
      table === "listing_sizes" ? sizesThenable : listingChain,
    ),
    _listingChain: listingChain,
    _sizesChain: sizesChain,
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
    expect(supabase._listingChain.update).toHaveBeenCalledWith({
      status: "sold",
    });
    expect(supabase._sizesChain.update).toHaveBeenCalledWith({
      status: "sold",
    });
    expect(supabase._sizesChain.eq).toHaveBeenCalledWith(
      "listing_id",
      LISTING_ID,
    );
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
    const supabase = makeSupabase({ data: [], error: null });
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

describe("markSizeSold", () => {
  it("marks the single size sold and invalidates tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markSizeSold(LISTING_ID, SIZE_ID);

    expect(result).toEqual({});
    expect(supabase._sizesChain.update).toHaveBeenCalledWith({
      status: "sold",
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
    expect(await markSizeSold("", SIZE_ID)).toEqual({
      error: "Invalid listing id",
    });
    expect(await markSizeSold(LISTING_ID, "")).toEqual({
      error: "Invalid size id",
    });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns 'Size not found' when no row matches (wrong owner or id)", async () => {
    const supabase = makeSupabase(
      { data: [{ id: LISTING_ID }], error: null },
      { data: [], error: null },
    );
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
