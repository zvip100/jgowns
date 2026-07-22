import { isValidUUID } from "@/lib/utils";
import { WISHLIST_MAX_ITEMS, WISHLIST_STORAGE_VERSION } from "@/lib/types";

import type {
  WishlistItem,
  WishlistMergeItem,
  WishlistSnapshot,
  WishlistStatusEntry,
  WishlistStorageValue,
} from "@/lib/types";

const EMPTY_STORAGE: WishlistStorageValue = {
  version: WISHLIST_STORAGE_VERSION,
  ownerId: null,
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
    return {
      version: WISHLIST_STORAGE_VERSION,
      ownerId: typeof parsed.ownerId === "string" ? parsed.ownerId : null,
      items: parsed.items as WishlistItem[],
    };
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

/** Strips a wishlist item down to the id + snapshot sent to `mergeWishlist`. */
export function toWishlistMergePayload(
  items: WishlistItem[],
): WishlistMergeItem[] {
  return items.map(({ listingId, snapshot }) => ({ listingId, snapshot }));
}

export type WishlistReconcileInput = {
  isAuthenticated: boolean;
  /** The id of the user whose session is active, or `null` when signed out /
   * the server read was unavailable. */
  currentUserId: string | null;
  /** The account this local cache currently mirrors (`null` = guest cache). */
  ownerId: string | null;
  localItems: WishlistItem[];
  /** Account wishlist, or `null` when the server read was unavailable. */
  serverItems: WishlistItem[] | null;
};

/**
 * What the provider should do once both localStorage and the server payload are
 * known, decided purely from the current session and the cache's `ownerId` (never
 * device history). Pure so the branching is unit-testable.
 *
 * - `keep-local`: signed out, or the server read failed. localStorage stands.
 * - `merge`: signed in and the cache is this user's (or a guest cache), with
 *   local items to fold in. Upsert them, then adopt the canonical list.
 * - `use-server`: signed in with nothing local to merge, OR the cache mirrors a
 *   different account (discard it wholesale). The account is authoritative.
 */
export type WishlistReconcilePlan =
  | { type: "keep-local" }
  | { type: "merge"; payload: WishlistMergeItem[] }
  | { type: "use-server"; items: WishlistItem[] };

export function planWishlistReconcile(
  input: WishlistReconcileInput,
): WishlistReconcilePlan {
  if (!input.isAuthenticated || input.currentUserId === null || input.serverItems === null) {
    return { type: "keep-local" };
  }
  // Guest cache (null owner) or a cache this same user already owns: fold local
  // items in. A cache owned by a different, known user is discarded wholesale
  // (falls through to use-server), never partially merged.
  const isOwnCache =
    input.ownerId === null || input.ownerId === input.currentUserId;
  if (isOwnCache && input.localItems.length > 0) {
    return { type: "merge", payload: toWishlistMergePayload(input.localItems) };
  }
  return { type: "use-server", items: input.serverItems };
}

/**
 * Applies a `/api/wishlist/status` refresh, scoped to `requestedIds` (the set the
 * response was computed for): requested ids get live status and a self-healed
 * snapshot, or `unavailable` if absent (removed/deleted) while keeping their last
 * snapshot. Items outside the set are left untouched, so a response that resolves
 * after the list changed can't wrongly mark newer items unavailable.
 */
export function applyWishlistStatusRefresh(
  items: WishlistItem[],
  statusById: Map<string, WishlistStatusEntry>,
  requestedIds: ReadonlySet<string>,
): WishlistItem[] {
  return items.map((item) => {
    if (!requestedIds.has(item.listingId)) return item;
    const entry = statusById.get(item.listingId);
    if (!entry) return { ...item, status: "unavailable" };
    return { ...item, status: entry.status, snapshot: entry.snapshot };
  });
}
