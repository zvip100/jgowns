import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { BrowseFilters } from "@/lib/types";
import { anonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import type {
  Listing,
  ListingByIdResult,
  ListingsListResult,
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

export async function fetchListings(
  filters: BrowseFilters,
): Promise<ListingsListResult> {
  "use cache";
  applyListingsCachePolicy();

  let query = anonClient
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);

  const inColumns = ["size", "color", "location"] as const;
  for (const key of inColumns) {
    const values = filters[key];
    if (!values?.length) continue;
    if (values.length === 1) query = query.eq(key, values[0]);
    else query = query.in(key, values);
  }

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
    console.error("[listings-queries] Failed to load listings", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      filters,
    });
  }

  return { listings, error };
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
