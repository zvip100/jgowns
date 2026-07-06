import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BROWSE_PAGE_SIZE, totalPagesFromCount } from "@/lib/browse-pagination";
import { decodeSizeFilterToken } from "@/lib/gown-sizes";
import { sortListingSizes } from "@/lib/listing-variants";
import type { BrowseFilters } from "@/lib/types";
import { anonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import type {
  ListingByIdResult,
  ListingReadError,
  ListingsPageResult,
  ListingWithSizes,
  PriceBounds,
} from "@/lib/types";

// Widened to `string` so supabase-js skips literal select-string type
// inference, which exceeds TS instantiation depth on the embed syntax.
const LISTING_WITH_SIZES_SELECT: string = "*, sizes:listing_sizes(*)";

/**
 * Browse select: `sizes` carries every variant for display; the aliased
 * `matched_sizes` inner join only exists so variant-level filters
 * (availability, size, price) decide whether the listing appears at all.
 */
const BROWSE_LISTINGS_SELECT: string = `${LISTING_WITH_SIZES_SELECT}, matched_sizes:listing_sizes!inner(id)`;
const BROWSE_COUNT_SELECT: string = "id, matched_sizes:listing_sizes!inner(id)";

function applyListingsCachePolicy() {
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings");
}

function withSortedSizes(row: unknown): ListingWithSizes {
  const { matched_sizes: _matched, sizes, ...rest } = row as Record<
    string,
    unknown
  >;
  // Supabase embeds are untyped; the select strings above match ListingWithSizes.
  const listing = rest as ListingWithSizes;
  listing.sizes = sortListingSizes((sizes ?? []) as ListingWithSizes["sizes"]);
  return listing;
}

function normalizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function selectListingById(
  supabase: SupabaseClient,
  normalizedId: string,
  logContext: "anon" | "session",
): Promise<ListingByIdResult> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_SIZES_SELECT)
    .eq("id", normalizedId)
    .maybeSingle();

  if (error) {
    console.error(
      `[listings-queries] Failed to load listing by id (${logContext})`,
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        id: normalizedId,
      },
    );
    return { listing: null, error: { message: error.message } };
  }

  return {
    listing: listing ? withSortedSizes(listing) : null,
    error: null,
  };
}

/**
 * Variant-level filters (availability, size, price) target the
 * `matched_sizes` inner join: a listing matches when at least one available
 * variant satisfies all of them at once.
 */
function applyBrowseFilters<
  Q extends {
    eq: (column: string, value: string) => Q;
    in: (column: string, values: string[]) => Q;
    or: (filters: string, options?: { referencedTable?: string }) => Q;
    gte: (column: string, value: number) => Q;
    lte: (column: string, value: number) => Q;
  },
>(query: Q, filters: BrowseFilters): Q {
  let next = query.eq("matched_sizes.status", "available");

  if (filters.category) next = next.eq("category", filters.category);

  if (filters.size?.length) {
    const pairs = filters.size
      .map((token) => decodeSizeFilterToken(token))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (pairs.length === 1) {
      next = next
        .eq("matched_sizes.size_group", pairs[0].sizeGroup)
        .eq("matched_sizes.size", pairs[0].size);
    } else if (pairs.length > 1) {
      const orFilter = pairs
        .map(
          (p) => `and(size_group.eq.${p.sizeGroup},size.eq.${p.size})`,
        )
        .join(",");
      next = next.or(orFilter, { referencedTable: "matched_sizes" });
    }
  }

  const inColumns = ["color", "location"] as const;
  for (const key of inColumns) {
    const values = filters[key];
    if (!values?.length) continue;
    if (values.length === 1) next = next.eq(key, values[0]);
    else next = next.in(key, values);
  }

  if (filters.cond === "no-alterations") {
    next = next.in("condition", ["Brand New", "Perfect Condition"]);
  } else if (filters.cond) {
    next = next.eq("condition", filters.cond);
  }
  if (Number.isFinite(filters.minPrice)) {
    next = next.gte("matched_sizes.price", filters.minPrice as number);
  }
  if (Number.isFinite(filters.maxPrice)) {
    next = next.lte("matched_sizes.price", filters.maxPrice as number);
  }

  return next;
}

async function fetchFilteredListingsCount(
  filters: BrowseFilters,
): Promise<{ totalCount: number; error: ListingReadError }> {
  const countQuery = applyBrowseFilters(
    anonClient
      .from("listings")
      .select(BROWSE_COUNT_SELECT, { count: "exact", head: true })
      .eq("status", "active"),
    filters,
  );

  const { count, error } = await countQuery;

  if (error) {
    return { totalCount: 0, error: { message: error.message } };
  }

  return { totalCount: count ?? 0, error: null };
}

export async function fetchListingsPage(
  filters: BrowseFilters,
  page: number,
  pageSize: number = BROWSE_PAGE_SIZE,
): Promise<ListingsPageResult> {
  "use cache";
  applyListingsCachePolicy();

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = applyBrowseFilters(
    anonClient
      .from("listings")
      .select(BROWSE_LISTINGS_SELECT, { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    filters,
  );

  const { data: listings, count, error } = await query.range(from, to);

  let totalCount = count ?? 0;
  let totalPages = totalPagesFromCount(totalCount, pageSize);

  if (error) {
    console.error("[listings-queries] Failed to load listings page", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      filters,
      page: safePage,
      pageSize,
    });

    if (safePage > 1) {
      const countResult = await fetchFilteredListingsCount(filters);
      if (!countResult.error) {
        totalCount = countResult.totalCount;
        totalPages = totalPagesFromCount(totalCount, pageSize);
        return {
          listings: [],
          totalCount,
          page: safePage,
          pageSize,
          totalPages,
          error: { message: error.message },
        };
      }
    }

    return {
      listings: null,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      error: { message: error.message },
    };
  }

  return {
    listings: (listings ?? []).map(withSortedSizes),
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    error: null,
  };
}

export async function fetchListing(id: string): Promise<ListingByIdResult> {
  "use cache";
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    applyListingsCachePolicy();
    return { listing: null, error: null };
  }

  applyListingsCachePolicy();
  cacheTag(`listing:${normalizedId}`);

  return selectListingById(anonClient, normalizedId, "anon");
}

/** Uncached: request cookies so RLS can return the row to the owning seller (e.g. sold/removed). */
export async function fetchListingAsOwner(
  id: string,
): Promise<ListingByIdResult> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return { listing: null, error: null };
  }

  const supabase = await createClient();
  return selectListingById(supabase, normalizedId, "session");
}

/** Public lookup first; falls back to session-scoped query for sold/removed listings visible to the owner. */
export const fetchListingWithFallback = cache(
  async (id: string): Promise<ListingByIdResult> => {
    const { listing, error } = await fetchListing(id);
    if (error) return { listing: null, error };
    if (listing) return { listing, error: null };

    return fetchListingAsOwner(id);
  },
);

export async function fetchPriceBounds(): Promise<PriceBounds> {
  "use cache";
  applyListingsCachePolicy();

  const { data, error } = await anonClient
    .from("listing_sizes")
    .select("price, listing:listings!inner(status)")
    .eq("status", "available")
    .eq("listing.status", "active")
    .order("price", { ascending: true });

  if (error) {
    console.error("[listings-queries] Failed to load price bounds", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { minBound: 0, maxBound: 10000 };
  }

  const prices = (data ?? [])
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value));

  if (prices.length === 0) {
    return { minBound: 0, maxBound: 10000 };
  }

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  const safeMax = max <= min ? min + 1000 : max;

  return { minBound: Math.max(0, min), maxBound: safeMax };
}
