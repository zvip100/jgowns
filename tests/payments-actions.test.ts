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
  mockPaymentIntentsRetrieve,
  mockRpc,
  mockCaptureServerEvent,
  mockServiceUpdate,
  mockServiceSessionEq,
  mockServiceStatusEq,
  mockServiceListingsUpdate,
  mockServicePaymentSelect,
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
  // isCheckoutSettling runs for real here (only the Stripe client is mocked),
  // so a complete/unpaid prior session reaches this.
  const mockPaymentIntentsRetrieve = vi.fn();
  const mockRpc = vi.fn();
  const mockCaptureServerEvent = vi.fn();
  const mockServiceUpdate = vi.fn();
  const mockServiceSessionEq = vi.fn();
  const mockServiceStatusEq = vi.fn();
  // Free publication moved to the service client in migration 025: the
  // listings_guard_status trigger refuses a seller-driven pending_payment ->
  // active, which is the fee bypass.
  const mockServiceListingsUpdate = vi.fn();
  // The payment row confirmListingPayment checks a paid session against before
  // handing the session id to the activation RPC.
  const mockServicePaymentSelect = vi.fn();

  return {
    mockServiceListingsUpdate,
    mockServicePaymentSelect,
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
    mockPaymentIntentsRetrieve,
    mockRpc,
    mockCaptureServerEvent,
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
vi.mock("@/lib/analytics/server", () => ({
  captureServerError: vi.fn(),
  captureServerEvent: mockCaptureServerEvent,
}));
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
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
    from: vi.fn((table: string) =>
      table === "listings"
        ? { update: mockServiceListingsUpdate }
        : { update: mockServiceUpdate, select: mockServicePaymentSelect },
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

const FEE_CENTS = 500;

/** A session Stripe reports as settled, and the row it must agree with. */
const PAID_SESSION = {
  payment_status: "paid",
  amount_total: FEE_CENTS,
  currency: "usd",
  metadata: { listing_id: LISTING_ID, user_id: USER_ID },
};

const PAYMENT_ROW = {
  listing_id: LISTING_ID,
  user_id: USER_ID,
  amount_cents: FEE_CENTS,
  currency: "usd",
};

function makePaymentRowChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  return chain;
}

/** The mapping check passes by default; the tests that care override it. */
function servicePaymentRow(result: { data: unknown; error: unknown }): void {
  mockServicePaymentSelect.mockReturnValue(makePaymentRowChain(result));
}

beforeEach(() => {
  mockServicePaymentSelect.mockReset();
  servicePaymentRow({ data: PAYMENT_ROW, error: null });
});

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
    mockPaymentIntentsRetrieve.mockReset();
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
          ...PAID_SESSION,
          status: "complete",
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

      // complete + unpaid is ambiguous on its own: an asynchronous payment sits
      // there while it settles AND after it fails. Only the PaymentIntent tells
      // the two apart, and reading it as failure is how a seller pays twice.
      describe("complete-but-unpaid prior session", () => {
        function priorComplete(paymentIntent: unknown = "pi_prior") {
          const supabase = makeCheckoutSupabase({
            priorPaymentResult: {
              data: { stripe_session_id: "cs_prior" },
              error: null,
            },
          });
          mockGetAuthClient.mockResolvedValue({
            ok: true,
            user: { id: USER_ID },
            supabase,
          });
          mockCheckoutSessionsRetrieve.mockResolvedValue({
            payment_status: "unpaid",
            status: "complete",
            payment_intent: paymentIntent,
          });
          return supabase;
        }

        function expectHeldBack(supabase: { _paymentInsert: unknown }): void {
          expect(mockRedirect).toHaveBeenCalledWith(
            "/dashboard/checkout/confirmed?outcome=processing",
          );
          expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
          expect(mockCheckoutSessionsExpire).not.toHaveBeenCalled();
          expect(supabase._paymentInsert).not.toHaveBeenCalled();
          expect(mockServiceUpdate).not.toHaveBeenCalled();
        }

        it("holds back a payment the intent reports as processing", async () => {
          const supabase = priorComplete();
          mockPaymentIntentsRetrieve.mockResolvedValue({ status: "processing" });

          await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
            "NEXT_REDIRECT",
          );

          expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith("pi_prior");
          expectHeldBack(supabase);
        });

        it("holds back a payment still awaiting a customer action", async () => {
          const supabase = priorComplete();
          mockPaymentIntentsRetrieve.mockResolvedValue({
            status: "requires_action",
          });

          await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
            "NEXT_REDIRECT",
          );

          expectHeldBack(supabase);
        });

        it("reads an expanded payment_intent object by its id", async () => {
          priorComplete({ id: "pi_expanded", status: "processing" });
          mockPaymentIntentsRetrieve.mockResolvedValue({ status: "processing" });

          await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
            "NEXT_REDIRECT",
          );

          expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith("pi_expanded");
        });

        // Fail closed: charging twice is worse than a wait the async_payment_failed
        // and checkout.session.expired webhooks both clear on their own.
        it("holds back when the intent cannot be read at all", async () => {
          const supabase = priorComplete();
          mockPaymentIntentsRetrieve.mockRejectedValue(new Error("stripe down"));
          const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

          await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
            "NEXT_REDIRECT",
          );

          expectHeldBack(supabase);
          consoleError.mockRestore();
        });

        it("holds back when the session carries no intent", async () => {
          const supabase = priorComplete(null);

          await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
            "NEXT_REDIRECT",
          );

          expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
          expectHeldBack(supabase);
        });

        // The other half: a declined payment must still retire and mint fresh,
        // or a seller whose card failed can never pay for the listing.
        it("retires and mints fresh once the intent reports a terminal failure", async () => {
          for (const status of ["requires_payment_method", "canceled"]) {
            vi.clearAllMocks();
            mockCheckoutSessionsCreate.mockResolvedValue({
              id: "cs_test_123",
              url: "https://checkout.stripe.com/pay/cs_test_123",
            });
            mockServiceStatusEq.mockResolvedValue({ error: null });
            mockServiceSessionEq.mockReturnValue({ eq: mockServiceStatusEq });
            mockServiceUpdate.mockReturnValue({ eq: mockServiceSessionEq });
            mockRedirect.mockImplementation(() => {
              throw new Error("NEXT_REDIRECT");
            });
            const supabase = priorComplete();
            mockPaymentIntentsRetrieve.mockResolvedValue({ status });

            await expect(createListingCheckout(LISTING_ID)).rejects.toThrow(
              "NEXT_REDIRECT",
            );

            expect(mockServiceUpdate).toHaveBeenCalledWith({ status: "expired" });
            expect(mockCheckoutSessionsCreate).toHaveBeenCalled();
            expect(supabase._paymentInsert).toHaveBeenCalled();
          }
        });
      });

      // No extra Stripe call on the paths that already decide for themselves.
      it("does not read the intent for an open or expired prior session", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: { stripe_session_id: "cs_prior" }, error: null },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
        mockCheckoutSessionsRetrieve.mockResolvedValue({
          payment_status: "unpaid",
          status: "open",
          url: "https://checkout.stripe.com/pay/cs_prior",
        });

        await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
        expect(mockRedirect).toHaveBeenCalledWith(
          "https://checkout.stripe.com/pay/cs_prior",
        );
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

      // A failed lookup is not an absence: reading it as one mints a second
      // payable session beside the open one this guard exists to find.
      it("fails closed when the prior-payment lookup itself errors", async () => {
        const supabase = makeCheckoutSupabase({
          priorPaymentResult: { data: null, error: { message: "db down" } },
        });
        mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

        const result = await createListingCheckout(LISTING_ID);

        expect(result).toEqual(CHECKOUT_UNAVAILABLE_ERROR);
        expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
        expect(supabase._paymentInsert).not.toHaveBeenCalled();
      });
    });
  });
});

describe("confirmListingPayment", () => {
  beforeEach(() => {
    mockRevalidateTag.mockClear();
    mockCaptureServerEvent.mockReset();
    mockCheckoutSessionsRetrieve.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: true, error: null });
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

    // Abandoned, not settling: no PaymentIntent lookup, and nothing that would
    // let the caller show a "still coming" message.
    expect(result).toEqual({ paid: false, processing: false });
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  // The seller finished Checkout with a delayed method: they HAVE paid, the
  // funds just have not settled. Without this the success route falls through
  // to "we couldn't confirm your payment" for a payment that is on its way.
  it("reports a settling payment as processing rather than a bare unpaid result", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "unpaid",
      status: "complete",
      payment_intent: "pi_settling",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });
    mockPaymentIntentsRetrieve.mockResolvedValue({ status: "processing" });

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, processing: true });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it("reports a terminally failed asynchronous payment as not processing", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "unpaid",
      status: "complete",
      payment_intent: "pi_declined",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });
    mockPaymentIntentsRetrieve.mockResolvedValue({
      status: "requires_payment_method",
    });

    await expect(confirmListingPayment("cs_test_1")).resolves.toEqual({
      paid: false,
      processing: false,
    });
  });

  it("does not activate a paid session missing listing/user metadata", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: {},
    });

    const result = await confirmListingPayment("cs_test_1");

    // Paid, so nothing is settling; the missing metadata is the blocker.
    expect(result).toEqual({ paid: false, processing: false });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("activates a paid session and invalidates both tags", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);

    const result = await confirmListingPayment("cs_test_1");

    expect(mockRpc).toHaveBeenCalledWith("record_listing_payment", {
      p_session_id: "cs_test_1",
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("listings", "max");
    expect(mockRevalidateTag).toHaveBeenCalledWith(`listing:${LISTING_ID}`, "max");
    expect(result).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
  });

  it("returns an error and skips invalidation when the activation RPC fails", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    mockRpc.mockResolvedValue({ error: { message: "P0002" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, error: "Could not activate listing." });
    expect(mockRevalidateTag).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // `listing_payments` takes seller-written inserts, so the row is the one part
  // of the activation the seller controls: pay for listing A, delete A (which
  // cascades the row and frees the unique session id), then point that spent
  // session at pending listing B. The RPC would publish B for free.
  it("refuses a payment row that names a different listing than the session", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    servicePaymentRow({
      data: { ...PAYMENT_ROW, listing_id: "22222222-2222-2222-2222-222222222222" },
      error: null,
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, error: "Could not activate listing." });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("refuses a payment row whose owner or amount disagrees with the session", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);

    servicePaymentRow({ data: { ...PAYMENT_ROW, user_id: "user-999" }, error: null });
    await expect(confirmListingPayment("cs_test_1")).resolves.toEqual({
      paid: false,
      error: "Could not activate listing.",
    });

    servicePaymentRow({ data: { ...PAYMENT_ROW, amount_cents: 1 }, error: null });
    await expect(confirmListingPayment("cs_test_1")).resolves.toEqual({
      paid: false,
      error: "Could not activate listing.",
    });

    servicePaymentRow({ data: { ...PAYMENT_ROW, currency: "eur" }, error: null });
    await expect(confirmListingPayment("cs_test_1")).resolves.toEqual({
      paid: false,
      error: "Could not activate listing.",
    });

    expect(mockRpc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("refuses a paid session with no payment row behind it", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    servicePaymentRow({ data: null, error: null });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: false, error: "Could not activate listing." });
    expect(mockRpc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("is idempotent: a second confirmation of an already-succeeded session is still a harmless success", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);

    const first = await confirmListingPayment("cs_test_1");
    const second = await confirmListingPayment("cs_test_1");

    expect(first).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
    expect(second).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe("payment_confirmed", () => {
  beforeEach(() => {
    mockRevalidateTag.mockClear();
    mockCaptureServerEvent.mockReset();
    mockCheckoutSessionsRetrieve.mockReset();
    mockRpc.mockReset();
  });

  it("fires once when the RPC reports the real activation", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    mockRpc.mockResolvedValue({ data: true, error: null });

    await confirmListingPayment("cs_test_1");

    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith("payment_confirmed", {
      listing_id: LISTING_ID,
      fee_cents: 500,
    });
  });

  // The webhook and the Checkout-success route both call this and both report
  // paid; only the RPC's transition report keeps it to one event per listing.
  it("stays silent on a replay the RPC reports as already active", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    await confirmListingPayment("cs_test_1");
    await confirmListingPayment("cs_test_1");

    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the RPC reports nothing (migration 037 not applied)", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await confirmListingPayment("cs_test_1");

    expect(result).toEqual({ paid: true, listingId: LISTING_ID, userId: USER_ID });
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it("stays silent when the activation RPC fails", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue(PAID_SESSION);
    mockRpc.mockResolvedValue({ data: null, error: { message: "P0002" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await confirmListingPayment("cs_test_1");

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("stays silent for a session Stripe reports as unpaid", async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      payment_status: "unpaid",
      metadata: { listing_id: LISTING_ID, user_id: USER_ID },
    });

    await confirmListingPayment("cs_test_1");

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});

describe("checkout_started", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mockCaptureServerEvent.mockReset();
    mockGetAuthClient.mockReset();
    mockIsListingFeeActive.mockReset().mockReturnValue(true);
    mockGetListingFeeCents.mockReset().mockReturnValue(500);
    mockGetSessionContact.mockReset().mockResolvedValue({
      email: "seller@example.com",
      phone: null,
    });
    mockCheckoutSessionsRetrieve.mockReset();
    mockCheckoutSessionsCreate.mockReset().mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
  });

  it("fires with the fee once the session and its payment row exist", async () => {
    const supabase = makeCheckoutSupabase();
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

    await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith("checkout_started", {
      listing_id: LISTING_ID,
      fee_cents: 500,
    });
  });

  it("stays silent when Stripe refuses to create the session", async () => {
    const supabase = makeCheckoutSupabase();
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
    mockCheckoutSessionsCreate.mockRejectedValue(new Error("stripe down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await createListingCheckout(LISTING_ID);

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("stays silent when the payment row cannot be written", async () => {
    const supabase = makeCheckoutSupabase({
      paymentInsertResult: { error: { message: "insert failed" } },
    });
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await createListingCheckout(LISTING_ID);

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("stays silent on the free-publish path, where no checkout exists", async () => {
    mockIsListingFeeActive.mockReturnValue(false);
    const supabase = makeCheckoutSupabase();
    mockGetAuthClient.mockResolvedValue({ ok: true, user: { id: USER_ID }, supabase });

    await expect(createListingCheckout(LISTING_ID)).rejects.toThrow("NEXT_REDIRECT");

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
