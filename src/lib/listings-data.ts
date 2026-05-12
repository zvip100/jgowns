import { cacheLife, cacheTag } from "next/cache";

import { canonicalBrowseQueryString } from "@/lib/browse-params";
import { anonClient } from "@/lib/supabase/anon";
import { GOWN_CATEGORIES, type GownCategoryId, type Listing } from "@/lib/types";

export type PageSearchParams = {
  [key: string]: string | string[] | undefined;
};

const ALLOWED_CATEGORY = new Set<string>(
  GOWN_CATEGORIES.map((c) => c.id),
);

export type ListingsFilters = {
  category?: GownCategoryId;
  size?: string;
  color?: string;
  location?: string;
  cond?: string;
  minPrice?: number;
  maxPrice?: number;
};

function applyListingsCachePolicy() {
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings");
}

function normalizeListingId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(params: PageSearchParams): ListingsFilters {
  const minPriceValue = firstParamValue(params.minPrice);
  const maxPriceValue = firstParamValue(params.maxPrice);
  const rawCategory = firstParamValue(params.category);
  const category =
    rawCategory && ALLOWED_CATEGORY.has(rawCategory)
      ? (rawCategory as GownCategoryId)
      : undefined;
  return {
    category,
    size: firstParamValue(params.size),
    color: firstParamValue(params.color),
    location: firstParamValue(params.location),
    cond: firstParamValue(params.cond),
    minPrice: minPriceValue ? Number(minPriceValue) : undefined,
    maxPrice: maxPriceValue ? Number(maxPriceValue) : undefined,
  };
}

export function hasActiveBrowseFilters(filters: ListingsFilters): boolean {
  return !!(
    filters.category ||
    filters.size ||
    filters.color ||
    filters.location ||
    filters.cond ||
    Number.isFinite(filters.minPrice) ||
    Number.isFinite(filters.maxPrice)
  );
}

/** Canonical filter query for `?back=` on `/browse/[id]` (no `/browse` prefix). */
export function buildBrowseBackQuery(filters: ListingsFilters): string {
  const filterParams = new URLSearchParams();

  if (filters.category) filterParams.set("category", filters.category);
  if (filters.size) filterParams.set("size", filters.size);
  if (filters.color) filterParams.set("color", filters.color);
  if (filters.location) filterParams.set("location", filters.location);
  if (filters.cond) filterParams.set("cond", filters.cond);
  if (Number.isFinite(filters.minPrice))
    filterParams.set("minPrice", String(filters.minPrice));
  if (Number.isFinite(filters.maxPrice))
    filterParams.set("maxPrice", String(filters.maxPrice));
  return canonicalBrowseQueryString(filterParams);
}

export async function fetchListings(
  filters: ListingsFilters,
): Promise<{ listings: Listing[] | null; error: { message: string } | null }> {
  "use cache";
  applyListingsCachePolicy();

  let query = anonClient
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.category)
    query = query.eq("category", filters.category);
  if (filters.size) query = query.eq("size", filters.size);
  if (filters.color) query = query.eq("color", filters.color);
  if (filters.location) query = query.eq("location", filters.location);
  if (filters.cond === "no-alterations") {
    query = query.in("condition", ["Brand New", "Perfect Condition"]);
  } else if (filters.cond) {
    query = query.eq("condition", filters.cond);
  }
  if (Number.isFinite(filters.minPrice))
    query = query.gte("price", filters.minPrice);
  if (Number.isFinite(filters.maxPrice))
    query = query.lte("price", filters.maxPrice);

  const { data: listings, error } = await query;

  if (error) {
    console.error("[listings-data] Failed to load listings", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      filters,
    });
  }

  return { listings, error };
}

export async function fetchListingById(
  id: string,
): Promise<{ listing: Listing | null; error: { message: string } | null }> {
  "use cache";
  const normalizedId = normalizeListingId(id);
  if (!normalizedId) {
    applyListingsCachePolicy();
    return { listing: null, error: null };
  }

  applyListingsCachePolicy();
  cacheTag(`listing:${normalizedId}`);

  const { data: listing, error } = await anonClient
    .from("listings")
    .select("*")
    .eq("id", normalizedId)
    .maybeSingle();

  if (error) {
    console.error("[listings-data] Failed to load listing by id", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      id: normalizedId,
    });
    return { listing: null, error: { message: error.message } };
  }

  return { listing: listing as Listing | null, error: null };
}

export async function fetchPriceBounds(): Promise<{
  minBound: number;
  maxBound: number;
}> {
  "use cache";
  applyListingsCachePolicy();

  const { data } = await anonClient
    .from("listings")
    .select("price")
    .eq("status", "active")
    .order("price", { ascending: true });

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
