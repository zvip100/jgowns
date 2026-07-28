import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function importFresh() {
  const { vi } = await import("vitest");
  vi.resetModules();
  return import("@/lib/listing-fee");
}

describe("listing-fee", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    // Keep fee assertions independent of an ambient PAYMENTS_SUSPENDED; the
    // suspend-behavior tests set it explicitly.
    delete process.env.PAYMENTS_SUSPENDED;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to fee 0 and inactive when LISTING_FEE_CENTS is unset", async () => {
    delete process.env.LISTING_FEE_CENTS;
    delete process.env.PAYMENTS_SUSPENDED;
    const { getListingFeeCents, isListingFeeActive } = await importFresh();
    expect(getListingFeeCents()).toBe(0);
    expect(isListingFeeActive()).toBe(false);
  });

  it("is inactive when LISTING_FEE_CENTS is 0", async () => {
    process.env.LISTING_FEE_CENTS = "0";
    const { getListingFeeCents, isListingFeeActive } = await importFresh();
    expect(getListingFeeCents()).toBe(0);
    expect(isListingFeeActive()).toBe(false);
  });

  it("is active with a positive integer fee", async () => {
    process.env.LISTING_FEE_CENTS = "500";
    const { getListingFeeCents, isListingFeeActive } = await importFresh();
    expect(getListingFeeCents()).toBe(500);
    expect(isListingFeeActive()).toBe(true);
  });

  it("throws at import when LISTING_FEE_CENTS is not a number", async () => {
    process.env.LISTING_FEE_CENTS = "not-a-number";
    await expect(importFresh()).rejects.toThrow(/non-negative integer/);
  });

  it("throws at import when LISTING_FEE_CENTS is negative", async () => {
    process.env.LISTING_FEE_CENTS = "-5";
    await expect(importFresh()).rejects.toThrow(/non-negative integer/);
  });

  it("throws at import when LISTING_FEE_CENTS is a non-integer", async () => {
    process.env.LISTING_FEE_CENTS = "5.5";
    await expect(importFresh()).rejects.toThrow(/non-negative integer/);
  });

  it("is inactive when suspended, even with a positive fee (amount preserved)", async () => {
    process.env.LISTING_FEE_CENTS = "500";
    process.env.PAYMENTS_SUSPENDED = "true";
    const { getListingFeeCents, isListingFeeActive } = await importFresh();
    expect(getListingFeeCents()).toBe(500);
    expect(isListingFeeActive()).toBe(false);
  });

  it("treats any value other than the literal 'true' as not suspended", async () => {
    process.env.LISTING_FEE_CENTS = "500";
    process.env.PAYMENTS_SUSPENDED = "yes";
    const { isListingFeeActive } = await importFresh();
    expect(isListingFeeActive()).toBe(true);
  });
});
