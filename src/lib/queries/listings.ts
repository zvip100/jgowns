import { cacheLife, cacheTag } from "next/cache";

import { BROWSE_PAGE_SIZE, totalPagesFromCount } from "@/lib/browse-pagination";
import { decodeSizeFilterToken } from "@/lib/gown-sizes";
import { sortListingSizes } from "@/lib/listing-variants";
import type { BrowseFilters } from "@/lib/types";
import { anonClient } from "@/lib/supabase/anon";
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
  normalizedId: string,
): Promise<ListingByIdResult> {
  // 'removed' is soft-deleted and 'pending_payment' is unpaid and not yet
  // published, so neither is viewable here, including by its own seller (who
  // manages those from the dashboard, not a public-shaped detail page).
  const { data: listing, error } = await anonClient
    .from("listings")
    .select(LISTING_WITH_SIZES_SELECT)
    .eq("id", normalizedId)
    .in("status", ["active", "sold"])
    .maybeSingle();

  if (error) {
    console.error("[queries/listings] Failed to load listing by id", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      id: normalizedId,
    });
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
    console.error("[queries/listings] Failed to load listings page", {
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

  return selectListingById(normalizedId);
}


type SitemapListing = { id: string; created_at: string };

const SITEMAP_PAGE_SIZE = 1000;

/**
 * Active listing ids + timestamps for the sitemap. Paginated because PostgREST
 * caps a single response at max_rows (1000); a plain select would silently
 * truncate the sitemap as the catalog grows.
 */
export async function fetchActiveListingsForSitemap(): Promise<
  SitemapListing[]
> {
  "use cache";
  applyListingsCachePolicy();

  const rows: SitemapListing[] = [];

  for (let page = 0; ; page++) {
    const from = page * SITEMAP_PAGE_SIZE;
    const to = from + SITEMAP_PAGE_SIZE - 1;

    const { data, error } = await anonClient
      .from("listings")
      .select("id, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[queries/listings] Failed to load listings for sitemap", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return rows;
    }

    if (!data?.length) break;
    rows.push(...(data as SitemapListing[]));
    if (data.length < SITEMAP_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchPriceBounds(): Promise<PriceBounds> {
  "use cache";
  applyListingsCachePolicy();

  // Ordered limit(1) queries instead of fetching all rows: PostgREST caps
  // responses at max_rows (1000), which would silently truncate the data
  // and corrupt the max bound as the table grows.
  const boundsQuery = (ascending: boolean) =>
    anonClient
      .from("listing_sizes")
      .select("price, listing:listings!inner(status)")
      .eq("status", "available")
      .eq("listing.status", "active")
      .order("price", { ascending })
      .limit(1)
      .maybeSingle();

  const [minResult, maxResult] = await Promise.all([
    boundsQuery(true),
    boundsQuery(false),
  ]);

  const error = minResult.error ?? maxResult.error;
  if (error) {
    console.error("[queries/listings] Failed to load price bounds", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { minBound: 0, maxBound: 10000 };
  }

  const minPrice = Number(minResult.data?.price);
  const maxPrice = Number(maxResult.data?.price);

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return { minBound: 0, maxBound: 10000 };
  }

  const min = Math.floor(minPrice);
  const max = Math.ceil(maxPrice);
  const safeMax = max <= min ? min + 1000 : max;

  return { minBound: Math.max(0, min), maxBound: safeMax };
}
