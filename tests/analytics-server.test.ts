import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const captureImmediate = vi.fn().mockResolvedValue(undefined);
const captureExceptionImmediate = vi.fn().mockResolvedValue(undefined);
const shutdown = vi.fn().mockResolvedValue(undefined);
const constructed: { token: string; options: Record<string, unknown> }[] = [];
let constructorError: Error | null = null;

vi.mock("posthog-node", () => ({
  PostHog: class {
    captureImmediate = captureImmediate;
    captureExceptionImmediate = captureExceptionImmediate;
    shutdown = shutdown;
    constructor(token: string, options: Record<string, unknown>) {
      if (constructorError) throw constructorError;
      constructed.push({ token, options });
    }
  },
}));

// Outside a request scope the real after() throws, which is the fallback path
// captureServerError has to survive. Individual tests opt into the scheduled
// path by making this resolve the task instead.
const after = vi.fn<(task: () => Promise<void>) => void>(() => {
  throw new Error("after() was called outside a request scope");
});
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => after(task) }));

const ORIGINAL_ENV = { ...process.env };

const CONFIGURED = {
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://ph.jgowns.com",
};

async function importFresh(env: Record<string, string | undefined> = CONFIGURED) {
  process.env = { ...ORIGINAL_ENV, ...env };
  vi.resetModules();
  return import("@/lib/analytics/server");
}

beforeEach(() => {
  constructed.length = 0;
  constructorError = null;
  after.mockClear();
  after.mockImplementation(() => {
    throw new Error("after() was called outside a request scope");
  });
  captureImmediate.mockClear();
  captureExceptionImmediate.mockClear();
  shutdown.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("captureServerException", () => {
  it("sends the exception immediately and shuts the client down", async () => {
    const { captureServerException } = await importFresh();
    const error = new Error("boom");
    await captureServerException(error, { scope: "test" });

    expect(constructed).toEqual([
      {
        token: "phc_test",
        options: { host: "https://ph.jgowns.com", flushAt: 1, flushInterval: 0 },
      },
    ]);
    expect(captureExceptionImmediate).toHaveBeenCalledWith(error, undefined, {
      scope: "test",
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("wraps a Supabase-style error object so it groups on its message", async () => {
    const { captureServerException } = await importFresh();
    await captureServerException({ message: "duplicate key", code: "23505" });

    const [reported] = captureExceptionImmediate.mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toBe("duplicate key");
  });

  it("wraps a thrown non-object", async () => {
    const { captureServerException } = await importFresh();
    await captureServerException("just a string");

    const [reported] = captureExceptionImmediate.mock.calls[0];
    expect((reported as Error).message).toBe("just a string");
  });

  it("reports a ZodError that escaped to the framework", async () => {
    const { captureServerException } = await importFresh();
    const parsed = z.object({ email: z.string() }).safeParse({ email: 1 });

    await captureServerException(parsed.success ? null : parsed.error);
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it("never rejects when the client constructor throws", async () => {
    constructorError = new Error("bad token");
    const { captureServerException } = await importFresh();
    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();
    expect(captureExceptionImmediate).not.toHaveBeenCalled();
  });

  it("is a no-op when PostHog is not configured", async () => {
    const { captureServerException } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    await captureServerException(new Error("boom"));
    expect(constructed).toEqual([]);
  });

  it("is a no-op when only half the configuration is present", async () => {
    const { captureServerException } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    await captureServerException(new Error("boom"));
    expect(constructed).toEqual([]);
  });

  it("never rejects when the capture itself fails", async () => {
    captureExceptionImmediate.mockRejectedValueOnce(new Error("network down"));
    const { captureServerException } = await importFresh();
    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("never rejects when shutdown fails", async () => {
    shutdown.mockRejectedValueOnce(new Error("already closed"));
    const { captureServerException } = await importFresh();
    await expect(captureServerException(new Error("boom"))).resolves.toBeUndefined();
  });
});

describe("captureServerError", () => {
  it("logs to stdout and reports with the scope and default kind", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerError } = await importFresh();
    const error = new Error("row missing");

    await captureServerError(
      { scope: "payments.confirmListingPayment.recordPayment", properties: { listing_id: "l1" } },
      error,
    );

    expect(errors).toHaveBeenCalledWith(
      "[payments.confirmListingPayment.recordPayment]",
      error,
    );
    expect(captureExceptionImmediate).toHaveBeenCalledWith(error, undefined, {
      listing_id: "l1",
      scope: "payments.confirmListingPayment.recordPayment",
      kind: "exception",
    });
  });

  it("carries a config kind so an unset variable groups as an alarm", async () => {
    const { captureServerError } = await importFresh();
    await captureServerError(
      { scope: "contact.notify.config", kind: "config" },
      new Error("FORMSPREE_CONTACT_ENDPOINT is not set"),
    );

    expect(captureExceptionImmediate.mock.calls[0][2]).toEqual({
      scope: "contact.notify.config",
      kind: "config",
    });
  });

  it("logs a ZodError but does not report it as an exception", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerError } = await importFresh();
    const parsed = z.object({ email: z.string() }).safeParse({ email: 1 });

    await captureServerError(
      { scope: "sell.createListing" },
      parsed.success ? null : parsed.error,
    );

    expect(errors).toHaveBeenCalled();
    expect(constructed).toEqual([]);
    expect(captureExceptionImmediate).not.toHaveBeenCalled();
  });

  it("hands reporting to after() so it never sits in front of the response", async () => {
    let scheduled: (() => Promise<void>) | null = null;
    after.mockImplementation((task: () => Promise<void>) => {
      scheduled = task;
    });
    const { captureServerError } = await importFresh();

    await captureServerError({ scope: "contact.store" }, new Error("row missing"));

    expect(after).toHaveBeenCalledTimes(1);
    expect(captureExceptionImmediate).not.toHaveBeenCalled();

    await scheduled!();
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it("never rejects when the client constructor throws", async () => {
    constructorError = new Error("bad token");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerError } = await importFresh();
    await expect(
      captureServerError({ scope: "contact.store" }, new Error("boom")),
    ).resolves.toBeUndefined();
  });

  it("still logs when PostHog is not configured", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerError } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    await captureServerError({ scope: "cleanup.pendingListings.delete" }, "nope");

    expect(errors).toHaveBeenCalledWith("[cleanup.pendingListings.delete]", "nope");
    expect(constructed).toEqual([]);
  });
});

describe("captureServerEvent", () => {
  it("sends an anonymous event with no distinct id", async () => {
    const { captureServerEvent } = await importFresh();
    await captureServerEvent("payment_confirmed", { listing_id: "l1", fee_cents: 500 });

    expect(captureImmediate).toHaveBeenCalledWith({
      event: "payment_confirmed",
      properties: { listing_id: "l1", fee_cents: 500 },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when PostHog is not configured", async () => {
    const { captureServerEvent } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    await captureServerEvent("payment_confirmed");
    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("never rejects when the capture fails", async () => {
    captureImmediate.mockRejectedValueOnce(new Error("network down"));
    const { captureServerEvent } = await importFresh();
    await expect(captureServerEvent("register_completed")).resolves.toBeUndefined();
  });

  it("never rejects when the client constructor throws", async () => {
    constructorError = new Error("bad token");
    const { captureServerEvent } = await importFresh();
    await expect(captureServerEvent("payment_confirmed")).resolves.toBeUndefined();
    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("hands delivery to after() so it never sits in front of a redirect", async () => {
    let scheduled: (() => Promise<void>) | null = null;
    after.mockImplementation((task: () => Promise<void>) => {
      scheduled = task;
    });
    const { captureServerEvent } = await importFresh();

    await captureServerEvent("checkout_started", { listing_id: "l1", fee_cents: 500 });

    expect(after).toHaveBeenCalledTimes(1);
    expect(captureImmediate).not.toHaveBeenCalled();

    await scheduled!();
    expect(captureImmediate).toHaveBeenCalledWith({
      event: "checkout_started",
      properties: { listing_id: "l1", fee_cents: 500 },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
