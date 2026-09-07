import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import {
  ADMIN_OFF_MARKET_STATUS,
  AGE_SEGMENTS,
  OFF_MARKET_STATUSES,
  endOfDayMs,
  fetchAdminListPage,
  segmentCutoffIso,
} from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import { resolveUserEmails } from "./users";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type { AdminListing } from "@/lib/admin/types";
import type { Listing, ListingSize } from "@/lib/types";

/**
 * Admin listing reads. Never cached: admin data is user-specific by definition
 * and must reflect the moment it is read (AGENTS §2, spec §7). Bounded by the
 * admin select RLS policies, so these run on the publishable key like every
 * other RLS-expressible path.
 */

// Widened to `string` so supabase-js skips literal select-string type
// inference (mirrors queries/listings.ts).
const ADMIN_LISTING_SELECT: string = "*, sizes:listing_sizes(*)";

type AdminListingRow = Listing & {
  sizes: ListingSize[] | null;
};

function toAdminListing(
  row: AdminListingRow,
  emails: Map<string, string>,
  savedCounts: Map<string, number>,
): AdminListing {
  const { sizes, ...listing } = row;

  return {
    ...listing,
    sizes: sizes ?? [],
    saved_count: savedCounts.get(row.id) ?? 0,
    seller_email: emails.get(row.user_id) ?? ADMIN_EMPTY_VALUE,
  };
}

/** Wishlist saves per listing, returned as one aggregate JSON object. */
async function fetchSavedCounts(
  listingIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (listingIds.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_wishlist_counts", {
    p_listing_ids: listingIds,
  });

  if (error) logAndThrow("Failed to load saved counts", error);

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [listingId, count] of Object.entries(data)) {
      if (typeof count === "number") counts.set(listingId, count);
    }
  }

  return counts;
}

async function decorate(rows: AdminListingRow[]): Promise<AdminListing[]> {
  const [emails, savedCounts] = await Promise.all([
    resolveUserEmails(rows.map((row) => row.user_id)),
    fetchSavedCounts(rows.map((row) => row.id)),
  ]);

  return rows.map((row) => toAdminListing(row, emails, savedCounts));
}

function logAndThrow(
  message: string,
  error: { message: string; code?: string },
  context: Record<string, unknown> = {},
): never {
  console.error(`[queries/admin/listings] ${message}`, {
    message: error.message,
    code: error.code,
    ...context,
  });
  throw new Error(message);
}

export async function getAdminListings(
  params: AdminListParams,
  asOf: string,
): Promise<AdminListResult<AdminListing>> {
  const supabase = await createClient();

  const page = await fetchAdminListPage<AdminListingRow>(params, async (range) => {
    let query = supabase
      .from("listings")
      .select(ADMIN_LISTING_SELECT, { count: "exact" });

    // Segment pill. Age segments resolve their cutoff from the same rules the
    // in-memory matcher uses, so an overview card and this query cannot select
    // different rows for the same link.
    const rule = AGE_SEGMENTS[params.status];
    if (rule) {
      if (rule.status) query = query.eq("status", rule.status);
      const cutoff = segmentCutoffIso(rule, asOf);
      query =
        rule.side === "older"
          ? query.lte("created_at", cutoff)
          : query.gte("created_at", cutoff);
    } else if (params.status === ADMIN_OFF_MARKET_STATUS) {
      query = query.in("status", OFF_MARKET_STATUSES);
    } else if (params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.query) query = query.ilike("title", `%${params.query}%`);
    if (params.from) {
      query = query.gte("created_at", new Date(params.from).toISOString());
    }
    if (params.to) {
      query = query.lte(
        "created_at",
        new Date(endOfDayMs(params.to)).toISOString(),
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(range.from, range.to);

    if (error) logAndThrow("Failed to load listings", error);

    return {
      rows: (data ?? []) as unknown as AdminListingRow[],
      count: count ?? 0,
    };
  });

  return { ...page, rows: await decorate(page.rows) };
}

export async function getAdminListing(id: string): Promise<AdminListing | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("listings")
    .select(ADMIN_LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) logAndThrow("Failed to load listing", error, { id });
  if (!data) return null;

  const [listing] = await decorate([data as unknown as AdminListingRow]);
  return listing;
}

/** Every listing by one seller, newest first, for the user detail page. */
export async function getAdminListingsForUser(
  userId: string,
): Promise<AdminListing[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("listings")
    .select(ADMIN_LISTING_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) logAndThrow("Failed to load seller listings", error, { userId });

  return decorate((data ?? []) as unknown as AdminListingRow[]);
}
