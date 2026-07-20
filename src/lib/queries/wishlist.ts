import { listingPriceSummary } from "@/lib/listing-variants";
import { anonClient } from "@/lib/supabase/anon";

import type { ListingWithSizes, WishlistStatusEntry } from "@/lib/types";

// Widened to `string` so supabase-js skips literal select-string type
// inference (mirrors listings-queries.ts's LISTING_WITH_SIZES_SELECT).
const WISHLIST_STATUS_SELECT: string =
  "id, title, status, sell_mode, bundle_price, image_urls, image_blur_data_urls, sizes:listing_sizes(*)";

/**
 * Live status + a self-healed display snapshot for wishlisted listing ids.
 * Ids absent from the result are "no longer available" (removed or hard-
 * deleted) — the caller (route handler) treats a missing id as such.
 */
export async function getWishlistStatus(
  ids: string[],
): Promise<WishlistStatusEntry[]> {
  if (ids.length === 0) return [];

  const { data, error } = await anonClient
    .from("listings")
    .select(WISHLIST_STATUS_SELECT)
    .in("id", ids)
    .in("status", ["active", "sold"]);

  if (error) {
    console.error("[queries/wishlist] Failed to load wishlist status", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      ids,
    });
    throw new Error("Failed to load wishlist status");
  }

  return (data ?? []).map((row: unknown) => {
    // Supabase embeds are untyped; the select string above matches this shape.
    const listing = row as Record<string, unknown> as ListingWithSizes;
    return {
      id: listing.id,
      status: listing.status as "active" | "sold",
      snapshot: {
        title: listing.title,
        priceLabel: listingPriceSummary(listing),
        image: listing.image_urls[0] ?? null,
        blurDataUrl: listing.image_blur_data_urls[0] ?? null,
      },
    };
  });
}
