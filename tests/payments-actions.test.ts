import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUpdateTag,
  mockRevalidateTag,
  mockRedirect,
  mockGetAuthClient,
  mockIsListingFeeActive,
  mockGetListingFeeCents,
  mockGetSessionContact,
  mockCheckoutSessionsCreate,
  mockCheckoutSessionsRetrieve,
  mockCheckoutSessionsExpire,
  mockRpc,
  mockServiceUpdate,
  mockServiceSessionEq,
  mockServiceStatusEq,
  mockServiceListingsUpdate,
} = vi.hoisted(() => {
  const mockUpdateTag = vi.fn();
  const mockRevalidateTag = vi.fn();
  const mockRedirect = vi.fn().mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  const mockGetAuthClient = vi.fn();
  const mockIsListingFeeActive = vi.fn();
  const mockGetListingFeeCents = vi.fn();
  const mockGetSessionContact = vi.fn();
  const mockCheckoutSessionsCreate = vi.fn();
  const mockCheckoutSessionsRetrieve = vi.fn();
  const mockCheckoutSessionsExpire = vi.fn();
  const mockRpc = vi.fn();
  const mockServiceUpdate = vi.fn();
  const mockServiceSessionEq = vi.fn();
  const mockServiceStatusEq = vi.fn();
  // Free publication moved to the service client in migration 025: the
  // listings_guard_status trigger refuses a seller-driven pending_payment ->
  // active, which is the fee bypass.
  const mockServiceListingsUpdate = vi.fn();

  return {
    mockServiceListingsUpdate,
    mockUpdateTag,
    mockRevalidateTag,
    mockRedirect,
    mockGetAuthClient,
    mockIsListingFeeActive,
    mockGetListingFeeCents,
    mockGetSessionContact,
    mockCheckoutSessionsCreate,
    mockCheckoutSessionsRetrieve,
    mockCheckoutSessionsExpire,
    mockRpc,
    mockServiceUpdate,
    mockServiceSessionEq,
    mockServiceStatusEq,
  };
});

vi.mock("next/cache", () => ({
  updateTag: mockUpdateTag,
  revalidateTag: mockRevalidateTag,
}));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/actions/auth", () => ({ getAuthClient: mockGetAuthClient }));
vi.mock("@/lib/listing-fee", () => ({
  isListingFeeActive: mockIsListingFeeActive,
  getListingFeeCents: mockGetListingFeeCents,
}));
vi.mock("@/lib/queries/auth", () => ({ getSessionContact: mockGetSessionContact }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
        retrieve: mockCheckoutSessionsRetrieve,
        expire: mockCheckoutSessionsExpire,
      },
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
    from: vi.fn((table: string) =>
      table === "listings"
        ? { update: mockServiceListingsUpdate }
        : { update: mockServiceUpdate },
    ),
  }),
}));

import { createListingCheckout, confirmListingPayment } from "@/lib/actions/payments";

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "user-123";
// Mirrors the module-local constant in payments.ts; a "use server" file can
// only export async functions, so it can't be imported.
const CHECKOUT_UNAVAILABLE_ERROR = {
  error: "Your listing is saved. Please retry payment.",
};

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  return chain;
}

function makePriorPaymentChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

type CheckoutSupabaseOpts = {
  listingResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
  paymentInsertResult?: { error: unknown };
  priorPaymentResult?: { data: unknown; error: unknown };
};

function makeCheckoutSupabase(opts: CheckoutSupabaseOpts = {}) {
  const listingSelectChain = makeSelectChain(
    opts.listingResult ?? {
      data: { id: LISTING_ID, status: "pending_payment" },
      error: null,
    },
  );
  const updateChain = makeUpdateChain(
    opts.updateResult ?? { data: [{ id: LISTING_ID }], error: null },
  );
  const priorPaymentChain = makePriorPaymentChain(
    opts.priorPaymentResult ?? { data: null, error: null },
  );
  const paymentInsert = vi
    .fn()
    .mockResolvedValue(opts.paymentInsertResult ?? { error: null });

  // The free-publish status write is made by the SERVICE client now, so that
  // chain is what the assertions inspect; the seller client only reads here.
  mockServiceListingsUpdate.mockReturnValue(updateChain);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "listing_payments") {
      return {
        insert: paymentInsert,
        select: vi.fn().mockReturnValue(priorPaymentChain),
      };
    }
    return {
      select: vi.fn().mockReturnValue(listingSelectChain),
      update: vi.fn().mockReturnValue(updateChain),
    };
  });

  return { from, _paymentInsert: paymentInsert, _updateChain: updateChain };
}

describe("createListingCheckout", () => {
  beforeEach(() => {
    mockUpdateTag.mockClear();
    mockRevalidateTag.mockClear();
    mockRedirect.mockClear();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mockGetAuthClient.mockReset();
    mockIsListingFeeActive.mockReset();
    mockGetListingFeeCents.mockReset();
    mockGetSessionContact.mockReset();
    mockGetSessionContact.mockResolvedValue({ email: "seller@example.com", phone: null });
    mockCheckoutSessionsCreate.mockReset();
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
    mockCheckoutSessionsExpire.mockReset();
    mockCheckoutSessionsExpire.mockResolvedValue({ id: "cs_prior", status: "expired" });
    mockServiceStatusEq.mockReset().mockResolvedValue({ error: null });
    mockServiceSessionEq.mockReset().mockReturnValue({ eq: mockServiceStatusEq });
    mockServiceUpdate.mockReset().mockReturnValue({ eq: mockServiceSessionEq });
  });

  it("rejects an invalid listing id", async () => {
    const result = await createListingCheckout("");
    expect(result).toEqual({ error: "Invalid listing id" });
    expect(mockGetAuthClient).not.toHaveBeenCalled();
  });

  it("returns the auth error when not authenticated", async () => {
    mockGetAuthClient.mockResolvedValue({ ok: false, error: "Not authenticated" });
    const result = await createListingCheckout(LISTING_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns 'Listing not found' when the listing doesn't exist or isn't owned", async () => {
    const supabase = makeCheckoutSupabase({ listingResult: { data: null, error: null } });
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

    const result = await createListingCheckout(LISTING_ID);
    expect(result).toEqual({ error: "Listing not found" });
  });

  it("rejects a listing that isn't pending_payment", async () => {
    const supabase = makeCheckoutSupabase({
      listingResult: { data: { id: LISTING_ID, status: "active" }, error: null },
    });
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

    const result = await createListingCheckout(LISTING_ID);
    expect(result).toEqual({ error: "This listing doesn't need a payment." });
  });

  describe("payments off (suspended or fee 0/unset)", () => {
    beforeEach(() => {
      mockIsListingFeeActive.mockReturnValue(false);
    });

    it("activates the listing for free, invalidates both tags, and redirects to the dashboard", async () => {
      const supabase = makeCheckoutSupabase();
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

      await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

      expect(supabase._updateChain.eq).toHaveBeenCalledWith("status", "pending_payment");
      // The write must come from the service client: the guard trigger refuses
      // a seller-driven pending_payment -> active (that is the fee bypass), and
      // the ownership predicates below stand in for the RLS this skips.
      expect(mockServiceListingsUpdate).toHaveBeenCalledWith({ status: "active" });
      expect(supabase._updateChain.eq).toHaveBeenCalledWith("user_id", USER_ID);
      expect(supabase._updateChain.eq).toHaveBeenCalledWith("id", LISTING_ID);
      expect(mockUpdateTag).toHaveBeenCalledWith("listings");
      expect(mockUpdateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`);
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
      expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("returns a typed error with no tag invalidation when the scoped update matches no row", async () => {
      const supabase = makeCheckoutSupabase({
        updateResult: { data: [], error: null },
      });
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

      const result = await createListingCheckout(LISTING_ID);

      expect(result).toEqual({ error: "This listing doesn't need a payment." });
      expect(mockUpdateTag).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("payments active", () => {
    beforeEach(() => {
      mockIsListingFeeActive.mockReturnValue(true);
      mockGetListingFeeCents.mockReturnValue(500);
    });

    it("creates a Checkout session, records the payment row, and redirects to Stripe", async () => {
      const supabase = makeCheckoutSupabase();
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

      await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          client_reference_id: LISTING_ID,
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
          customer_email: "seller@example.com",
          success_url: expect.stringContaining("/dashboard/checkout/success?session_id={CHECKOUT_SESSION_ID}"),
          cancel_url: expect.stringContaining(`/dashboard/checkout/canceled?listing=${LISTING_ID}`),
          integration_identifier: expect.any(String),
        }),
      );
      const call = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(call).not.toHaveProperty("payment_method_types");
      expect(call.line_items).toEqual([
        {
          price_data: {
            currency: "usd",
            unit_amount: 500,
            product_data: { name: "JGowns listing fee" },
          },
          quantity: 1,
        },
      ]);

      expect(supabase._paymentInsert).toHaveBeenCalledWith({
        listing_id: LISTING_ID,
        user_id: USER_ID,
        stripe_session_id: "cs_test_123",
        amount_cents: 500,
      });
      expect(mockRedirect).toHaveBeenCalledWith("https://checkout.stripe.com/pay/cs_test_123");
      expect(mockUpdateTag).not.toHaveBeenCalled();
    });

    it("logs and returns the retry error, deleting nothing, when session creation fails", async () => {
      const supabase = makeCheckoutSupabase();
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
      mockCheckoutSessionsCreate.mockRejectedValue(new Error("stripe down"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createListingCheckout(LISTING_ID);

      expect(result).toEqual(CHECKOUT_UNAVAILABLE_ERROR);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(supabase._paymentInsert).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("returns the retry error when Stripe returns a session with no URL", async () => {
      const supabase = makeCheckoutSupabase();
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
      mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test_123", url: null });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createListingCheckout(LISTING_ID);

      expect(result).toEqual(CHECKOUT_UNAVAILABLE_ERROR);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(supabase._paymentInsert).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("returns the retry error when recording the payment row fails", async () => {
      const supabase = makeCheckoutSupabase({ paymentInsertResult: { error: { message: "db down" } } });
      mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createListingCheckout(LISTING_ID);

      expect(result).toEqual(CHECKOUT_UNAVAILABLE_ERROR);
      expect(mockRedirect).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    describe("double-charge guard on an existing pending payment", () => {
      beforeEach(() => {
        mockCheckoutSessionsRetrieve.mockReset();
        mockRpc.mockReset();
        mockRpc.mockResolvedValue({ error: null });
      });

      it("activates an already-paid prior session and shows the paid confirmation without charging again", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "paid",
          status: "complete",
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
        });

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockRpc).toHaveBeenCalledWith("record_listing_payment", {
          p_session_id: "cs_prior",
        });
        expect(mockRedirect).toHaveBeenCalledWith(
          `/dashboard/checkout/confirmed?outcome=paid&listing=${LISTING_ID}`,
        );
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
        expect(supabase._paymentInsert).not.toHaveBeenCalled();
        expect(mockServiceUpdate).not.toHaveBeenCalled();
      });

      it("sends the seller to the processing page when the prior session's state can't be verified", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockRejectedValue(new Error("stripe down"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockRedirect).toHaveBeenCalledWith(
          "/dashboard/checkout/confirmed?outcome=processing",
        );
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
        expect(supabase._paymentInsert).not.toHaveBeenCalled();
        consoleError.mockRestore();
      });

      it("resumes an open unpaid prior session instead of minting a second one", async () => {
        const priorUrl = "https://checkout.stripe.com/pay/cs_prior";
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "unpaid",
          status: "open",
          url: priorUrl,
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
        });

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockRedirect).toHaveBeenCalledWith(priorUrl);
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
        expect(supabase._paymentInsert).not.toHaveBeenCalled();
        expect(mockServiceUpdate).not.toHaveBeenCalled();
        expect(mockRpc).not.toHaveBeenCalled();
      });

      it("mints a fresh session when the prior session was expired (unpaid)", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "unpaid",
          status: "expired",
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
        });

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockServiceUpdate).toHaveBeenCalledWith({ status: "expired" });
        expect(mockServiceSessionEq).toHaveBeenCalledWith(
          "stripe_session_id",
          "cs_prior",
        );
        expect(mockServiceStatusEq).toHaveBeenCalledWith("status", "pending");
        expect(mockCheckoutSessionsExpire).not.toHaveBeenCalled();
        expect(mockCheckoutSessionsCreate).toHaveBeenCalled();
        expect(mockRedirect).toHaveBeenCalledWith(
          "https://checkout.stripe.com/pay/cs_test_123",
        );
        expect(mockRpc).not.toHaveBeenCalled();
      });

      it("expires an open session missing a URL before minting a fresh one", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "unpaid",
          status: "open",
          url: null,
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
        });

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockCheckoutSessionsExpire).toHaveBeenCalledWith("cs_prior");
        expect(mockServiceUpdate).toHaveBeenCalledWith({ status: "expired" });
        expect(mockCheckoutSessionsCreate).toHaveBeenCalled();
      });

      it("returns the retry error when retiring the prior payment row fails", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "unpaid",
          status: "expired",
          metadata: { listing_id: LISTING_ID, user_id: USER_ID },
        });
        mockServiceStatusEq.mockResolvedValue({ error: { message: "db down" } });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        const result = await createListingCheckout(LISTING_ID);

        expect(result).toEqual(CHECKOUT_UNAVAILABLE_ERROR);
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
        consoleError.mockRestore();
      });
    });
  });
});

describe("confirmListingPayment", () => {
  beforeEach(() => {
    mockRevalidateTag.mockClear();
    mockCheckoutSessionsRetrieve.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("rejects an invalid session id", async () => {
    const result = await confirmListingPayment("");
    expect(result).toEqual({ paid: false, error: "Invalid session id" });
    expect(mockCheckoutSessionsRetrieve).not.toHaveBeenCalled();
  });

  it("returns an error when Stripe retrieval fails", async () => {
    mockCheckoutSessionsRetrieve.mockRejectedValue(new Error("not found"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, error: "Could not verify payment." });
    expect(mockRpc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not activate an unpaid session", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "unpaid",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it("does not activate a paid session missing listing/user metadata", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: {},
    });

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("activates a paid session and invalidates both tags", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });

    const result = await confirmListingPayment("cs_test_1");

    expect(mockRpc).toHaveBeenCalledWith("record_listing_payment", {
      p_session_id: "cs_test_1",
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("listings", "max");
    expect(mockRevalidateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`, "max");
    expect(result).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
  });

  it("returns an error and skips invalidation when the activation RPC fails", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });
    mockRpc.mockResolvedValue({ error: { message: "P0002" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, error: "Could not activate listing." });
    expect(mockRevalidateTag).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("is idempotent: a second confirmation of an already-succeeded session is still a harmless success", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });

    const first = await confirmListingPayment("cs_test_1");
    const second = await confirmListingPayment("cs_test_1");

    expect(first).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
    expect(second).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
