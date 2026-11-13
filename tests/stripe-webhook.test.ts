import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCaptureServerError,
  mockConfirmListingPayment,
  mockConstructEvent,
  mockEq,
  mockStatusEq,
  mockUpdate,
} = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(),
  mockConfirmListingPayment: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockEq: vi.fn(),
  mockStatusEq: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerError: mockCaptureServerError,
}));
vi.mock("@/lib/actions/payments", () => ({
  confirmListingPayment: mockConfirmListingPayment,
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}));

type WebhookPost = typeof import("@/app/api/stripe/webhook/route").POST;

const DAY_MS = 24 * 60 * 60 * 1000;

let POST: WebhookPost;

function webhookRequest(body: string, signature?: string): NextRequest {
  return new NextRequest("https://jgowns.test/api/stripe/webhook", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : undefined,
  });
}

function stripeEvent(type: string, session: Record<string, unknown>) {
  return { type, data: { object: session } };
}

function failSignatureVerification(): Error {
  const signatureError = new Error("bad signature");
  mockConstructEvent.mockImplementation(() => {
    throw signatureError;
  });
  return signatureError;
}

beforeEach(async () => {
  // A fresh module per test resets the signature-failure window.
  vi.resetModules();
  ({ POST } = await import("@/app/api/stripe/webhook/route"));
  mockCaptureServerError.mockReset();
  mockConfirmListingPayment.mockReset();
  mockConfirmListingPayment.mockResolvedValue({ paid: true, listingId: "l1", userId: "u1" });
  mockConstructEvent.mockReset();
  mockStatusEq.mockReset().mockResolvedValue({ error: null });
  mockEq.mockReset().mockReturnValue({ eq: mockStatusEq });
  mockUpdate.mockReset().mockReturnValue({ eq: mockEq });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/stripe/webhook", () => {
  it("rejects a request with no signature header", async () => {
    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing Stripe signature." });
    expect(mockConstructEvent).not.toHaveBeenCalled();
    // A bare POST is internet noise, not a misconfigured secret.
    expect(mockCaptureServerError).not.toHaveBeenCalled();
  });

  it("rejects and logs, but does not report, a single failed signature", async () => {
    const errorSpy = vi.spyOn(console, "error");
    const signatureError = failSignatureVerification();

    const response = await POST(webhookRequest("{}", "sig_bad"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid signature." });
    expect(errorSpy).toHaveBeenCalledWith("[stripe.webhook.signature]", signatureError);
    expect(mockCaptureServerError).not.toHaveBeenCalled();
  });

  it("reports a config error once sustained failures cross the threshold, then stays quiet for the window", async () => {
    const signatureError = failSignatureVerification();

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await POST(webhookRequest("{}", "sig_bad"));
      expect(response.status).toBe(400);
    }

    expect(mockCaptureServerError).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      {
        scope: "stripe.webhook.signature",
        kind: "config",
        properties: { failures_in_window: 3 },
      },
      signatureError,
    );
  });

  it("does not report failures split across windows, and counts afresh in the new one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      failSignatureVerification();

      await POST(webhookRequest("{}", "sig_bad"));
      await POST(webhookRequest("{}", "sig_bad"));
      vi.setSystemTime(Date.now() + DAY_MS);
      await POST(webhookRequest("{}", "sig_bad"));
      await POST(webhookRequest("{}", "sig_bad"));
      expect(mockCaptureServerError).not.toHaveBeenCalled();

      await POST(webhookRequest("{}", "sig_bad"));
      expect(mockCaptureServerError).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("confirms payment on checkout.session.completed when payment_status is paid", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockConfirmListingPayment).toHaveBeenCalledWith("cs_1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("does not confirm on checkout.session.completed when payment_status is unpaid (delayed payment method)", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "unpaid" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    // Nor retired: the payment may still be settling, and async_payment_failed
    // is what says otherwise. createListingCheckout and removeListing now read
    // the same state the same way, so this half of the contract is pinned.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("confirms payment on checkout.session.async_payment_succeeded", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.async_payment_succeeded", { id: "cs_2" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockConfirmListingPayment).toHaveBeenCalledWith("cs_2");
    expect(response.status).toBe(200);
  });

  it("marks the payment row expired on checkout.session.async_payment_failed", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.async_payment_failed", { id: "cs_3" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockUpdate).toHaveBeenCalledWith({ status: "expired" });
    expect(mockEq).toHaveBeenCalledWith("stripe_session_id", "cs_3");
    expect(mockStatusEq).toHaveBeenCalledWith("status", "pending");
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("marks the payment row expired on checkout.session.expired", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.expired", { id: "cs_4" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockUpdate).toHaveBeenCalledWith({ status: "expired" });
    expect(mockEq).toHaveBeenCalledWith("stripe_session_id", "cs_4");
    expect(mockStatusEq).toHaveBeenCalledWith("status", "pending");
    expect(response.status).toBe(200);
  });

  it("returns 500 so Stripe retries when marking the row expired fails", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.expired", { id: "cs_7" }),
    );
    mockStatusEq.mockResolvedValue({ error: { message: "db down" } });

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });

  it("acknowledges and ignores unhandled event types", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("customer.created", { id: "cus_1" }),
    );

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("returns 500 so Stripe retries when confirmation fails", async () => {
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.completed", { id: "cs_5", payment_status: "paid" }),
    );
    mockConfirmListingPayment.mockResolvedValue({ paid: false, error: "db down" });

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });

  it("logs and acknowledges a paid session that was not activated without an error", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    mockConstructEvent.mockReturnValue(
      stripeEvent("checkout.session.completed", { id: "cs_6", payment_status: "paid" }),
    );
    mockConfirmListingPayment.mockResolvedValue({ paid: false });

    const response = await POST(webhookRequest("{}", "sig_ok"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("cs_6"));
  });
});
