"use server";

import { z } from "zod";

import { getAuthClient } from "@/lib/actions/auth";
import { getUserWishlist } from "@/lib/queries/wishlist";
import { WISHLIST_MAX_ITEMS } from "@/lib/types";
import { isValidUUID } from "@/lib/utils";

import type { WishlistItem, WishlistMergeItem, WishlistSnapshot } from "@/lib/types";

// No cache invalidation anywhere in this file: wishlist data is user-specific
// and never cached (`src/lib/queries/wishlist.ts` is deliberately not
// `"use cache"`), so there is no cacheTag to invalidate. The AGENTS §3
// "every CRUD action invalidates a tag" rule is satisfied vacuously.

// Match the UUID validation the route handler and storage layer already use, so
// an id accepted there isn't rejected here by a stricter RFC check.
const uuidSchema = z.string().refine(isValidUUID, "Invalid listing id.");

const snapshotSchema = z.object({
  title: z.string(),
  priceLabel: z.string(),
  image: z.string().nullable(),
  blurDataUrl: z.string().nullable(),
});

const mergeItemsSchema = z
  .array(z.object({ listingId: uuidSchema, snapshot: snapshotSchema }))
  .max(WISHLIST_MAX_ITEMS);

export type WishlistActionResult =
  | { success: true }
  | { success: false; error: string };

export type WishlistMergeResult =
  | { success: true; items: WishlistItem[] }
  | { success: false; error: string };

/** Add one gown to the signed-in user's account wishlist (idempotent). */
export async function addToWishlist(
  listingId: string,
  snapshot: WishlistSnapshot,
): Promise<WishlistActionResult> {
  const parsed = z
    .object({ listingId: uuidSchema, snapshot: snapshotSchema })
    .safeParse({ listingId, snapshot });
  if (!parsed.success) return { success: false, error: "Invalid wishlist item." };

  const auth = await getAuthClient();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase.from("wishlist_items").upsert(
    {
      user_id: auth.user.id,
      listing_id: parsed.data.listingId,
      snapshot: parsed.data.snapshot,
    },
    { onConflict: "user_id,listing_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[actions/wishlist] add failed", error.message);
    return { success: false, error: "Couldn't save this gown. Please try again." };
  }
  return { success: true };
}

/** Remove one gown from the signed-in user's account wishlist (idempotent). */
export async function removeFromWishlist(
  listingId: string,
): Promise<WishlistActionResult> {
  const parsed = uuidSchema.safeParse(listingId);
  if (!parsed.success) return { success: false, error: "Invalid listing id." };

  const auth = await getAuthClient();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("listing_id", parsed.data);

  if (error) {
    console.error("[actions/wishlist] remove failed", error.message);
    return { success: false, error: "Couldn't remove this gown. Please try again." };
  }
  return { success: true };
}

/**
 * Silent union merge on sign-in: fold the buyer's local (device-only) items into
 * their account, then return the canonical merged list. Duplicates collapse via
 * the composite PK (upsert-ignore). Hard-deleted ids are dropped first (they'd
 * fail the FK); sold/removed rows still exist, so keep-everything survives.
 */
export async function mergeWishlist(
  items: WishlistMergeItem[],
): Promise<WishlistMergeResult> {
  const parsed = mergeItemsSchema.safeParse(items);
  if (!parsed.success) return { success: false, error: "Invalid wishlist data." };

  const auth = await getAuthClient();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, user } = auth;

  const local = parsed.data;
  if (local.length > 0) {
    const ids = local.map((item) => item.listingId);
    const { data: existing, error: existError } = await supabase.rpc(
      "existing_listing_ids",
      { p_ids: ids },
    );
    if (existError) {
      console.error("[actions/wishlist] existence check failed", existError.message);
      return { success: false, error: "Couldn't sync your wishlist. Please try again." };
    }

    const existingIds = new Set((existing ?? []) as string[]);
    const rows = local
      .filter((item) => existingIds.has(item.listingId))
      .map((item) => ({
        user_id: user.id,
        listing_id: item.listingId,
        snapshot: item.snapshot,
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("wishlist_items")
        .upsert(rows, { onConflict: "user_id,listing_id", ignoreDuplicates: true });
      if (upsertError) {
        console.error("[actions/wishlist] merge upsert failed", upsertError.message);
        return { success: false, error: "Couldn't sync your wishlist. Please try again." };
      }
    }
  }

  try {
    const merged = await getUserWishlist();
    return { success: true, items: merged };
  } catch {
    return { success: false, error: "Couldn't load your wishlist. Please try again." };
  }
}
