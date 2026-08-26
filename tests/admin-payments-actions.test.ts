import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdminActionClient,
  mockUpdateTag,
  mockRevalidateTag,
  mockRpc,
  mockFrom,
  mockConfirmListingPayment,
  calls,
} = vi.hoisted(() => ({
  mockGetAdminActionClient: vi.fn(),
  mockUpdateTag: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockConfirmListingPayment: vi.fn(),
  calls: [] as string[],
}));

vi.mock("next/cache", () => ({
  updateTag: mockUpdateTag,
  revalidateTag: mockRevalidateTag,
}));
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
vi.mock("@/lib/actions/payments", () => ({
  confirmListingPayment: mockConfirmListingPayment,
}));

import { adminRescuePayment } from "@/lib/actions/admin/payments";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "cs_test_stored_session";

function tableStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
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

  mockFrom.mockImplementation((table: string) => {
    if (table === "listing_payments") {
      calls.push("read:payment");
      return tableStub({
        data: {
          stripe_session_id: SESSION_ID,
          status: "pending",
          listing_id: LISTING_ID,
        },
        error: null,
      });
    }
    calls.push("read:listing");
    return tableStub({ data: { title: "Ivory lace gown" }, error: null });
  });

  mockConfirmListingPayment.mockImplementation(async () => {
    calls.push("confirm");
    return { paid: true, listingId: LISTING_ID, userId: "u1" };
  });

  mockRpc.mockImplementation(async (name: string) => {
    calls.push(`rpc:${name}`);
    return { error: null };
  });
});

describe("adminRescuePayment: guard", () => {
  it("returns the guard's error and confirms nothing", async () => {
    mockGetAdminActionClient.mockResolvedValue({
      ok: false,
      error: "Not authorized",
    });

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "Not authorized",
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
  });

  it("refuses a demo-mode request, so a fixture id never reaches Stripe", async () => {
    mockGetAdminActionClient.mockResolvedValue({
      ok: false,
      error: "Turn off demo mode to make changes.",
    });

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "Turn off demo mode to make changes.",
    });
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
  });

  it("rejects a malformed payment id before any read", async () => {
    for (const bad of ["", "payment-1", 9 as unknown as string]) {
      vi.clearAllMocks();
      allowAdmin();
      await expect(adminRescuePayment(bad)).resolves.toEqual({
        error: "Invalid payment id",
      });
      expect(mockFrom).not.toHaveBeenCalled();
    }
  });
});

describe("adminRescuePayment: session id provenance", () => {
  it("re-reads the row and confirms the stored session, never a client value", async () => {
    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({});
    expect(mockConfirmListingPayment).toHaveBeenCalledExactlyOnceWith(
      SESSION_ID,
    );
    expect(calls[0]).toBe("read:payment");
  });

  it("takes only one argument, so no caller can aim it at a Session", () => {
    expect(adminRescuePayment.length).toBe(1);
  });

  it("reports a missing payment row without confirming or logging", async () => {
    mockFrom.mockImplementation(() => tableStub({ data: null, error: null }));

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "Payment not found",
    });
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("declines a row that already succeeded, so the log gains no duplicate", async () => {
    mockFrom.mockImplementation(() =>
      tableStub({
        data: {
          stripe_session_id: SESSION_ID,
          status: "succeeded",
          listing_id: LISTING_ID,
        },
        error: null,
      }),
    );

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "This payment already activated its listing.",
    });
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propagates a sanitized error when the payment read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const chain = tableStub({ data: null, error: { message: "db down" } });
    mockFrom.mockImplementation(() => chain);

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
    expect(mockConfirmListingPayment).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("adminRescuePayment: outcomes", () => {
  it("logs payment.rescue after a confirmed activation, against the listing id", async () => {
    await adminRescuePayment(PAYMENT_ID);
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith("admin_log_event", {
      p_action: "payment.rescue",
      p_entity_type: "payment",
      // The payments trigger records the LISTING id, so the timeline lines up.
      p_entity_id: LISTING_ID,
      p_entity_label: "Ivory lace gown",
      p_reason: null,
    });
    expect(calls.indexOf("confirm")).toBeLessThan(
      calls.indexOf("rpc:admin_log_event"),
    );
  });

  it("surfaces an unpaid Session as an ordinary error and logs nothing", async () => {
    mockConfirmListingPayment.mockResolvedValue({ paid: false });

    const result = await adminRescuePayment(PAYMENT_ID);
    expect(result.error).toBe(
      "Stripe reports this Checkout Session is not paid.",
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes through the helper's own reason when it gives one", async () => {
    mockConfirmListingPayment.mockResolvedValue({
      paid: false,
      error: "Could not verify payment.",
    });

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({
      error: "Could not verify payment.",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("adds no invalidation of its own: confirmListingPayment already did it", async () => {
    await adminRescuePayment(PAYMENT_ID);
    expect(mockUpdateTag).not.toHaveBeenCalled();
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it("still reports success when only the audit write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({ error: { message: "log down" } });

    await expect(adminRescuePayment(PAYMENT_ID)).resolves.toEqual({});
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
