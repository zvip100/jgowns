import { listingPriceSummary } from "@/lib/listing-variants";
import { anonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

import type {
  ListingWithSizes,
  WishlistItem,
  WishlistSnapshot,
  WishlistStatusEntry,
} from "@/lib/types";

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

// The joined listing is null when its row is hidden from the buyer (removed or
// hard-deleted); a plain (non-`!inner`) embed keeps the wishlist row so we can
// fall back to the stored snapshot. Widened to `string` like the selects above.
const USER_WISHLIST_SELECT: string =
  "listing_id, created_at, snapshot, listing:listings(id, title, status, sell_mode, bundle_price, image_urls, image_blur_data_urls, sizes:listing_sizes(*))";

type UserWishlistRow = {
  listing_id: string;
  created_at: string;
  snapshot: WishlistSnapshot;
  listing: ListingWithSizes | null;
};

/**
 * The signed-in user's account wishlist, newest-first, joined to live listing
 * data with the stored snapshot as fallback for sold/removed rows. Session-
 * scoped (RLS via `auth.uid()`) and never cached: wishlist data is user-
 * specific (AGENTS §2). Throws on a query error so a failure is distinguishable
 * from a legitimately empty wishlist.
 */
export async function getUserWishlist(): Promise<WishlistItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("wishlist_items")
    .select(USER_WISHLIST_SELECT)
    .order("created_at", { ascending: false })
    .order("listing_id", { ascending: true });

  if (error) {
    console.error("[queries/wishlist] Failed to load user wishlist", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error("Failed to load user wishlist");
  }

  return ((data ?? []) as unknown as UserWishlistRow[]).map((row) => {
    const listing = row.listing;
    if (!listing) {
      return {
        listingId: row.listing_id,
        addedAt: row.created_at,
        status: "unavailable" as const,
        snapshot: row.snapshot,
      };
    }
    return {
      listingId: row.listing_id,
      addedAt: row.created_at,
      status: listing.status === "sold" ? ("sold" as const) : ("active" as const),
      snapshot: {
        title: listing.title,
        priceLabel: listingPriceSummary(listing),
        image: listing.image_urls[0] ?? null,
        blurDataUrl: listing.image_blur_data_urls[0] ?? null,
      },
    };
  });
}
