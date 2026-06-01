import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BROWSE_PAGE_SIZE, totalPagesFromCount } from "@/lib/browse-pagination";
import { decodeSizeFilterToken } from "@/lib/gown-sizes";
import type { BrowseFilters } from "@/lib/types";
import { anonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import type {
  Listing,
  ListingByIdResult,
  ListingReadError,
  ListingsPageResult,
  PriceBounds,
} from "@/lib/types";

function applyListingsCachePolicy() {
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings");
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
    .select("*")
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

  return { listing: listing as Listing | null, error: null };
}

function applyBrowseFilters<
  Q extends {
    eq: (column: string, value: string) => Q;
    in: (column: string, values: string[]) => Q;
    or: (filters: string) => Q;
    gte: (column: string, value: number) => Q;
    lte: (column: string, value: number) => Q;
  },
>(query: Q, filters: BrowseFilters): Q {
  let next = query;

  if (filters.category) next = next.eq("category", filters.category);

  if (filters.size?.length) {
    const pairs = filters.size
      .map((token) => decodeSizeFilterToken(token))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (pairs.length === 1) {
      next = next
        .eq("size_group", pairs[0].sizeGroup)
        .eq("size", pairs[0].size);
    } else if (pairs.length > 1) {
      const orFilter = pairs
        .map(
          (p) => `and(size_group.eq.${p.sizeGroup},size.eq.${p.size})`,
        )
        .join(",");
      next = next.or(orFilter);
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
    next = next.gte("price", filters.minPrice as number);
  }
  if (Number.isFinite(filters.maxPrice)) {
    next = next.lte("price", filters.maxPrice as number);
  }

  return next;
}

async function fetchFilteredListingsCount(
  filters: BrowseFilters,
): Promise<{ totalCount: number; error: ListingReadError }> {
  const countQuery = applyBrowseFilters(
    anonClient
      .from("listings")
      .select("*", { count: "exact", head: true })
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
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    filters,
  );

  const { data: listings, count, error } = await query.range(from, to);

  let totalCount = count ?? 0;
  let totalPages = totalPagesFromCount(totalCount, pageSize);

  if (error) {
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

    console.error("[listings-queries] Failed to load listings page", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      filters,
      page: safePage,
      pageSize,
    });

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
    listings: listings as Listing[] | null,
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    error: null,
  };
}

export async function fetchListingById(id: string): Promise<ListingByIdResult> {
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
export async function fetchListingByIdForSessionUser(
  id: string,
): Promise<ListingByIdResult> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return { listing: null, error: null };
  }

  const supabase = await createClient();
  return selectListingById(supabase, normalizedId, "session");
}

export async function fetchPriceBounds(): Promise<PriceBounds> {
  "use cache";
  applyListingsCachePolicy();

  const { data, error } = await anonClient
    .from("listings")
    .select("price")
    .eq("status", "active")
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
