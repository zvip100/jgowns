/** Non-negative integer cents; malformed values fail fast rather than silently charging $0/NaN. */
function parseListingFeeCents(): number {
  const raw = process.env.LISTING_FEE_CENTS;
  if (raw === undefined || raw.trim() === "") return 0;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `LISTING_FEE_CENTS must be a non-negative integer number of cents (got "${raw}").`,
    );
  }
  return value;
}

const LISTING_FEE_CENTS = parseListingFeeCents();
const PAYMENTS_SUSPENDED = process.env.PAYMENTS_SUSPENDED === "true";

export function getListingFeeCents(): number {
  return LISTING_FEE_CENTS;
}

/** True when a positive fee is configured and payments are not temporarily suspended. */
export function isListingFeeActive(): boolean {
  return LISTING_FEE_CENTS > 0 && !PAYMENTS_SUSPENDED;
}

/** `500` -> "$5", `550` -> "$5.50". */
export function formatFeeDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
