import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockConfirmListingPayment, mockGetCurrentUser } = vi.hoisted(() => ({
  mockConfirmListingPayment: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/actions/payments", () => ({
  confirmListingPayment: mockConfirmListingPayment,
}));
vi.mock("@/lib/queries/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://jgowns.test" }));

import { GET } from "@/app/(main)/dashboard/checkout/success/route";

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "99999999-9999-9999-9999-999999999999";

/** Stripe's redirect target, as it arrives. */
function request(sessionId?: string): Parameters<typeof GET>[0] {
  const url = new URL("https://jgowns.test/dashboard/checkout/success");
  if (sessionId) url.searchParams.set("session_id", sessionId);
  return { nextUrl: url } as Parameters<typeof GET>[0];
}

async function outcomeOf(sessionId = "cs_test_1"): Promise<URL> {
  const response = await GET(request(sessionId));
  expect(response.status).toBe(307);
  return new URL(response.headers.get("location") as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: USER_ID });
});

describe("checkout success route", () => {
  it("confirms a paid session for the payer and names the listing", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: true,
      listingId: LISTING_ID,
      userId: USER_ID,
    });

    const url = await outcomeOf();

    expect(url.pathname).toBe("/dashboard/checkout/confirmed");
    expect(url.searchParams.get("outcome")).toBe("paid");
    expect(url.searchParams.get("listing")).toBe(LISTING_ID);
  });

  // The charge landed but this browser is not the payer (signed out, expired
  // JWT, another account). Never route that to not_completed, and never leak
  // the listing id to a non-payer.
  it("shows the neutral processing state for a paid session it cannot attribute", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: true,
      listingId: LISTING_ID,
      userId: "someone-else",
    });

    const url = await outcomeOf();

    expect(url.searchParams.get("outcome")).toBe("processing");
    expect(url.searchParams.get("listing")).toBeNull();
  });

  // A delayed payment method: Checkout completed, the funds have not settled.
  // The seller HAS paid, so "we couldn't confirm your payment" would be wrong
  // and would invite a second attempt. async_payment_succeeded finishes it.
  it("shows processing for a payment that is still settling", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: false,
      processing: true,
    });

    await expect(
      outcomeOf().then((url) => url.searchParams.get("outcome")),
    ).resolves.toBe("processing");
  });

  it("shows processing when confirmation could not be verified", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: false,
      error: "Could not activate listing.",
    });

    await expect(
      outcomeOf().then((url) => url.searchParams.get("outcome")),
    ).resolves.toBe("processing");
  });

  it("reports a genuinely unpaid session as not completed", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: false,
      processing: false,
    });

    await expect(
      outcomeOf().then((url) => url.searchParams.get("outcome")),
    ).resolves.toBe("not_completed");
  });

  it("reports a missing session id without calling Stripe", async () => {
    const response = await GET(request());
    const url = new URL(response.headers.get("location") as string);

    expect(url.searchParams.get("outcome")).toBe("not_completed");
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
  });
});
