import { isValidUUID } from "@/lib/utils";
import { WISHLIST_MAX_ITEMS, WISHLIST_STORAGE_VERSION } from "@/lib/types";

import type {
  WishlistItem,
  WishlistSnapshot,
  WishlistStatusEntry,
  WishlistStorageValue,
} from "@/lib/types";

const EMPTY_STORAGE: WishlistStorageValue = {
  version: WISHLIST_STORAGE_VERSION,
  items: [],
};

function isWishlistSnapshot(value: unknown): value is WishlistSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.priceLabel === "string" &&
    (v.image === null || typeof v.image === "string") &&
    (v.blurDataUrl === null || typeof v.blurDataUrl === "string")
  );
}

function isWishlistItem(value: unknown): value is WishlistItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.listingId === "string" &&
    isValidUUID(v.listingId) &&
    typeof v.addedAt === "string" &&
    !Number.isNaN(Date.parse(v.addedAt)) &&
    (v.status === "active" || v.status === "sold" || v.status === "unavailable") &&
    isWishlistSnapshot(v.snapshot)
  );
}

/** Parses and validates the raw localStorage string; any malformed or foreign-shaped value resets to empty. */
export function parseWishlistStorage(raw: string | null): WishlistStorageValue {
  if (!raw) return EMPTY_STORAGE;

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.version !== WISHLIST_STORAGE_VERSION ||
      !Array.isArray(parsed.items) ||
      !parsed.items.every(isWishlistItem)
    ) {
      console.warn("[wishlist-storage] Discarding malformed wishlist data");
      return EMPTY_STORAGE;
    }
    return { version: WISHLIST_STORAGE_VERSION, items: parsed.items as WishlistItem[] };
  } catch (error) {
    console.warn("[wishlist-storage] Failed to parse wishlist data", error);
    return EMPTY_STORAGE;
  }
}

export function serializeWishlistStorage(value: WishlistStorageValue): string {
  return JSON.stringify(value);
}

/** Newest-first, per the drawer sort rule. */
export function sortWishlistItems(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort(
    (a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt),
  );
}

export type AddWishlistItemResult = {
  items: WishlistItem[];
  error: string | null;
};

/** Idempotent add: a no-op if already saved; rejects (never evicts) once the cap is hit. */
export function addWishlistItem(
  items: WishlistItem[],
  item: WishlistItem,
): AddWishlistItemResult {
  if (items.some((existing) => existing.listingId === item.listingId)) {
    return { items, error: null };
  }
  if (items.length >= WISHLIST_MAX_ITEMS) {
    return {
      items,
      error: "Wishlist is full. Remove a saved gown to add another.",
    };
  }
  return { items: [...items, item], error: null };
}

/** Idempotent remove: a no-op if the id isn't saved. */
export function removeWishlistItem(
  items: WishlistItem[],
  listingId: string,
): WishlistItem[] {
  return items.filter((item) => item.listingId !== listingId);
}

/**
 * Applies a `/api/wishlist/status` refresh: ids present in the response get
 * live status and a self-healed snapshot; ids absent are marked unavailable
 * (removed/deleted) while keeping their last-known snapshot, per the
 * "keep everything" decision.
 */
export function applyWishlistStatusRefresh(
  items: WishlistItem[],
  statusById: Map<string, WishlistStatusEntry>,
): WishlistItem[] {
  return items.map((item) => {
    const entry = statusById.get(item.listingId);
    if (!entry) return { ...item, status: "unavailable" };
    return { ...item, status: entry.status, snapshot: entry.snapshot };
  });
}
