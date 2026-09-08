import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthClient,
  mockUpdateTag,
  mockRevalidateTag,
  mockRetrieveSession,
  mockExpireSession,
  mockRetrieveIntent,
  mockServiceFrom,
} = vi.hoisted(() => ({
  mockGetAuthClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockRetrieveSession: vi.fn(),
  mockExpireSession: vi.fn(),
  mockRetrieveIntent: vi.fn(),
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
    paymentIntents: { retrieve: mockRetrieveIntent },
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
  rpcResult: { error: null | { message: string; code?: string } } = {
    error: null,
  },
  listingsResult: UpdateResult = { data: [{ id: LISTING_ID }], error: null },
  paymentsResult: PaymentsResult = { data: [], error: null },
) {
  const sizesChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(sizesResult),
  };
  // Thenable so removeListing's terminal `.select("id")` resolves the update
  // result off the same chain.
  const listingsChain = {
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
      error: { message: "Listing not found", code: "P0002" },
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

  it("never leaks the raw database message for an unmapped error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase(undefined, {
      error: { message: "duplicate key value violates ...", code: "23505" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markListingSold(LISTING_ID);
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
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
    expect(mockExpireSession).not.toHaveBeenCalled();
    // The status write goes through the RPC, never a direct update: the
    // listings_guard_status trigger refuses direct status writes (migration 025).
    expect(supabase._rpc).toHaveBeenCalledWith("remove_listing", {
      p_listing_id: LISTING_ID,
    });
    expect(supabase._listingsChain.update).not.toHaveBeenCalled();
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
    expect(mockUpdateTag).toHaveBeenCalledWith("listings");
  });

  it("expires an open Checkout session before soft-removing", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
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
    expect(supabase._rpc).toHaveBeenCalledWith("remove_listing", {
      p_listing_id: LISTING_ID,
    });
    expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
  });

  it("marks the payment expired without Stripe expire when the session is already closed", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
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
    expect(supabase._rpc).toHaveBeenCalledWith("remove_listing", {
      p_listing_id: LISTING_ID,
    });
  });

  it("refuses to remove when Checkout is already paid", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
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

  // complete + unpaid is not a failed payment on its own: a delayed method sits
  // there while it settles. Removing then takes the listing down while the fee
  // can still land, and activation only flips pending_payment to active.
  it("refuses to remove while an asynchronous payment is still settling", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "unpaid",
      status: "complete",
      payment_intent: "pi_settling",
    });
    mockRetrieveIntent.mockResolvedValue({ status: "processing" });

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({
      error: "Payment is completing. Refresh and try again.",
    });
    expect(mockRetrieveIntent).toHaveBeenCalledWith("pi_settling");
    expect(mockExpireSession).not.toHaveBeenCalled();
    expect(supabase._rpc).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  // The other half: a genuinely declined payment must still let the removal
  // through, or a seller whose card failed can never take the listing down.
  it("removes when the intent shows the payment terminally failed", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });
    mockRetrieveSession.mockResolvedValue({
      payment_status: "unpaid",
      status: "complete",
      payment_intent: "pi_declined",
    });
    mockRetrieveIntent.mockResolvedValue({ status: "requires_payment_method" });
    mockServiceExpireUpdate();

    const result = await removeListing(LISTING_ID);

    expect(result).toEqual({});
    expect(mockExpireSession).not.toHaveBeenCalled();
    expect(supabase._rpc).toHaveBeenCalledWith("remove_listing", {
      p_listing_id: LISTING_ID,
    });
  });

  it("returns an error and skips soft-remove when Stripe expire fails", async () => {
    const supabase = makeSupabase(undefined, undefined, undefined, {
      data: [{ stripe_session_id: SESSION_ID }],
      error: null,
    });
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

  it("returns 'Listing not found' when the RPC raises P0002", async () => {
    // remove_listing raises P0002 when no row matches the owner + not-already-
    // removed predicates; the action maps that code to the user-facing message.
    const supabase = makeSupabase(undefined, {
      error: { code: "P0002", message: "Listing not found" },
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

  it("never leaks a non-P0002 RPC error's raw database message", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase(undefined, {
      error: {
        code: "42501",
        message: "Listing status cannot be changed directly; use the listing actions",
      },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await removeListing(LISTING_ID);
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(mockUpdateTag).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
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
      error: { message: "Size not found", code: "P0002" },
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

  it("never leaks the raw database message for an unmapped error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase(undefined, {
      error: { message: "duplicate key value violates ...", code: "23505" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await markSizeSold(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
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
      error: { message: "Listing not found", code: "P0002" },
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

  it("never leaks the raw database message for an unmapped error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase(undefined, {
      error: { message: "duplicate key value violates ...", code: "23505" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateListing(LISTING_ID);
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("reactivateSize", () => {
  it("goes through the RPC and invalidates both tags", async () => {
    const supabase = makeSupabase();
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);

    expect(result).toEqual({});
    // The active-parent precondition is a predicate on the RPC's own UPDATE,
    // not a read before it, so no separate parent lookup happens here.
    expect(supabase._rpc).toHaveBeenCalledWith("reactivate_size", {
      p_listing_id: LISTING_ID,
      p_size_id: SIZE_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
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

  it("returns 'Size not found' when the RPC matched no row", async () => {
    const supabase = makeSupabase(undefined, {
      error: { message: "Size not found", code: "P0002" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Size not found" });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("names the parent status when the RPC refused on a non-active listing", async () => {
    const supabase = makeSupabase(undefined, {
      error: { message: "Listing is not active", code: "55000" },
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
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("never leaks the raw database message for an unmapped error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase(undefined, {
      error: { message: "duplicate key value violates ...", code: "23505" },
    });
    mockGetAuthClient.mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "user-1" },
    });

    const result = await reactivateSize(LISTING_ID, SIZE_ID);
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
