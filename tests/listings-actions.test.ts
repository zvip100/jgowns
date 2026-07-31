import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthClient,
  mockUpdateTag,
  mockRevalidateTag,
  mockRetrieveSession,
  mockExpireSession,
  mockServiceFrom,
} = vi.hoisted(() => ({
  mockGetAuthClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockRetrieveSession: vi.fn(),
  mockExpireSession: vi.fn(),
  mockServiceFrom: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: mockUpdateTag,
  revalidateTag: mockRevalidateTag,
}));
vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockGetAuthClient }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: mockRetrieveSession,
        expire: mockExpireSession,
      },
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}));

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
const SESSION_ID = "cs_test_session";

type UpdateResult = {
  data: { id: string }[] | null;
  error: null | { message: string };
};

type PaymentsResult = {
  data: { stripe_session_id: string }[] | null;
  error: null | { message: string };
};

function makeSupabase(
  sizesResult: UpdateResult = { data: [{ id: SIZE_ID }], error: null },
  rpcResult: { error: null | { message: string } } = { error: null },
  listingsResult: UpdateResult = { data: [{ id: LISTING_ID }], error: null },
  listingStatusResult: {
    data: { status: string } | null;
    error: null | { message: string };
  } = { data: { status: "active" }, error: null },
  paymentsResult: PaymentsResult = { data: [], error: null },
) {
  const sizesChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(sizesResult),
  };
  // Thenable so removeListing's terminal `.select("id")` resolves the update
  // result, while reactivateSize's `.select("status").eq().maybeSingle()`
  // resolves the parent-status read.
  const listingsChain = {
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(listingStatusResult),
    then: (resolve: (value: UpdateResult) => unknown) => resolve(listingsResult),
  };
  const paymentsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: PaymentsResult) => unknown) =>
      resolve(paymentsResult),
  };
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  return {
    from: vi.fn((table: string) => {
      if (table === "listings") return listingsChain;
      if (table === "listing_payments") return paymentsChain;
      return sizesChain;
    }),
    rpc,
    _listingsChain: listingsChain,
    _sizesChain: sizesChain,
    _paymentsChain: paymentsChain,
    _rpc: rpc,
  };
}

function mockServiceExpireUpdate(
  result: { error: null | { message: string } } = { error: null },
) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: { error: null | { message: string } }) => unknown) =>
      resolve(result),
  };
  mockServiceFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockGetAuthClient.mockReset();
  mockUpdateTag.mockReset();
  mockRevalidateTag.mockReset();
  mockRetrieveSession.mockReset();
  mockExpireSession.mockReset();
  mockServiceFrom.mockReset();
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
    expect(supabase.from).toHaveBeenCalledWith("listing_payments");
    expect(supabase.from).toHaveBeenCalledWith("listings");
    expect(mockExpireSession).not.toHaveBeenCalled();
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

  it("expires an open Checkout session before soft-removing", async () => {
    const supabase = makeSupabase(
      undefined,
      undefined,
      undefined,
      undefined,
      { data: [{ stripe_session_id: SESSION_ID }], error: null },
    );
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "unpaid",
      status: "open",
    });
    mockExpireSession.mockResolvedValue({});
    const serviceChain = mockServiceExpireUpdate();

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({});
    expect(mockRetrieveSession).toHaveBeenCalledWith(SESSION_ID);
    expect(mockExpireSession).toHaveBeenCalledWith(SESSION_ID);
    expect(serviceChain.update).toHaveBeenCalledWith({ status: "expired" });
    expect(serviceChain.eq).toHaveBeenCalledWith("stripe_session_id", SESSION_ID);
    expect(serviceChain.eq).toHaveBeenCalledWith("status", "pending");
    expect(supabase._listingsChain.update).toHaveBeenCalledWith({
      status: "removed",
    });
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
  });

  it("marks the payment expired without Stripe expire when the session is already closed", async () => {
    const supabase = makeSupabase(
      undefined,
      undefined,
      undefined,
      undefined,
      { data: [{ stripe_session_id: SESSION_ID }], error: null },
    );
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "unpaid",
      status: "expired",
    });
    mockServiceExpireUpdate();

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({});
    expect(mockExpireSession).not.toHaveBeenCalled();
    expect(supabase._listingsChain.update).toHaveBeenCalledWith({
      status: "removed",
    });
  });

  it("refuses to remove when Checkout is already paid", async () => {
    const supabase = makeSupabase(
      undefined,
      undefined,
      undefined,
      undefined,
      { data: [{ stripe_session_id: SESSION_ID }], error: null },
    );
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "paid",
      status: "complete",
    });

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({
      error: "Payment is completing. Refresh and try again.",
    });
    expect(mockExpireSession).not.toHaveBeenCalled();
    expect(supabase._listingsChain.update).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("returns an error and skips soft-remove when Stripe expire fails", async () => {
    const supabase = makeSupabase(
      undefined,
      undefined,
      undefined,
      undefined,
      { data: [{ stripe_session_id: SESSION_ID }], error: null },
    );
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "unpaid",
      status: "open",
    });
    mockExpireSession.mockRejectedValue(new Error("stripe down"));

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({
      error: "Couldn't cancel the open payment. Please try again.",
    });
    expect(supabase._listingsChain.update).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
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
    expect(supabase._listingsChain.select).toHaveBeenCalledWith("status");
    expect(supabase._listingsChain.eq).toHaveBeenCalledWith("id", LISTING_ID);
    expect(supabase._listingsChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase._listingsChain.maybeSingle).toHaveBeenCalled();
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

  it("returns 'Size not found' when the size row does not match", async () => {
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

  it("returns 'Listing not found' when the parent listing is missing or not owned", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: null,
      error: null,
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Listing not found" });
    expect(supabase._sizesChain.update).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("refuses to reactivate a size while the parent listing is not active", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: { status: "sold" },
      error: null,
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({
      error: "Reactivate the listing before changing its sizes",
    });
    expect(supabase._sizesChain.update).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
