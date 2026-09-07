import type { ListingSize, ListingWithSizes, SellMode } from "@/lib/types";

export function formatPrice(value: number): string {
  return `$${value.toLocaleString()}`;
}

/** Variants in display order: sort_order, then size (numeric-aware). */
export function sortListingSizes(sizes: ListingSize[]): ListingSize[] {
  return [...sizes].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.size.localeCompare(b.size, undefined, { numeric: true }),
  );
}

export function availableSizes(sizes: ListingSize[]): ListingSize[] {
  return sizes.filter((s) => s.status === "available");
}

/** `Size 8` / `Sizes 8, 10, 12` from available variants (all variants if none available). */
export function listingSizeSummary(listing: ListingWithSizes): string {
  const avail = availableSizes(listing.sizes);
  const pool = avail.length > 0 ? avail : listing.sizes;
  if (pool.length === 0) return "";
  const labels = sortListingSizes(pool).map((s) => s.size);
  return labels.length === 1
    ? `Size ${labels[0]}`
    : `Sizes ${labels.join(", ")}`;
}

/**
 * Buyer-facing price summary:
 * set-only bundle → `$1,150`; one variant → `$425`;
 * same price → `$425 each`; mixed → `From $400`.
 */
export function listingPriceSummary(listing: ListingWithSizes): string {
  if (listing.sell_mode === "set_only" && listing.bundle_price != null) {
    return formatPrice(listing.bundle_price);
  }

  const avail = availableSizes(listing.sizes);
  const pool = avail.length > 0 ? avail : listing.sizes;
  if (pool.length === 0) return "";

  const prices = pool.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (pool.length === 1) return formatPrice(min);
  if (min === max) return `${formatPrice(min)} each`;
  return `From ${formatPrice(min)}`;
}

/**
 * A stored listing or one still being submitted: form input carries no variant
 * status yet, and omits the per-size price for a set.
 */
export type PriceableListing = {
  sell_mode: SellMode;
  bundle_price?: number | null;
  sizes: readonly { price?: number | null; status?: ListingSize["status"] }[];
};

/**
 * The numeric twin of `listingPriceSummary`, and the only price analytics may
 * send: the figure the buyer actually saw, so a contact click is attributed to
 * the price that motivated it. Null when no price is knowable.
 */
export function listingPriceValue(listing: PriceableListing): number | null {
  if (listing.sell_mode === "set_only" && listing.bundle_price != null) {
    return listing.bundle_price;
  }

  const avail = listing.sizes.filter((s) => s.status !== "sold");
  const pool = avail.length > 0 ? avail : listing.sizes;
  const prices = pool
    .map((s) => s.price)
    .filter((price): price is number => typeof price === "number");

  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Secondary bundle note: `All for $1,150` (either) or `Complete set only` (set_only). */
export function listingBundleNote(listing: ListingWithSizes): string | null {
  if (listing.bundle_price == null) return null;
  if (listing.sell_mode === "either") {
    if (availableSizes(listing.sizes).length < 2) return null;
    return `All for ${formatPrice(listing.bundle_price)}`;
  }
  if (listing.sell_mode === "set_only") return "Complete set only";
  return null;
}

/**
 * Effective buyer-facing availability (§8): listing status is the source of
 * truth for sold/removed; individual/either listings are also sold out once
 * every variant is sold.
 */
export function isListingSoldOut(listing: ListingWithSizes): boolean {
  if (listing.status === "sold") return true;
  if (listing.status !== "active") return false;
  if (listing.sell_mode === "set_only") return false;
  return (
    listing.sizes.length > 0 &&
    listing.sizes.every((s) => s.status === "sold")
  );
}
