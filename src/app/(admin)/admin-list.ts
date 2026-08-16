import {
  ADMIN_PAGE_SIZE,
  NEW_LISTING_WINDOW_DAYS,
  STALE_ACTIVE_DAYS,
  STUCK_PENDING_PAYMENT_DAYS,
} from "@/lib/admin/constants";

import { paginateFixtures } from "./admin-fixtures";
import { firstSearchParam, parsePageParam } from "./admin-url";

import type { PageSearchParams } from "@/lib/types";

export type AdminListParams = {
  /** Segment pill value. "all" when nothing is selected. */
  status: string;
  /** Raw search box value, kept verbatim for the URL and the input. */
  searchQuery: string;
  /** Normalized search value, for matching only. */
  query: string;
  from: string;
  to: string;
  page: number;
};

export type AdminListResult<T> = {
  rows: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  params: AdminListParams;
  current: URLSearchParams;
};

/** Every admin list page reads the same five params off the URL. */
export function parseAdminListParams(
  params: PageSearchParams,
): AdminListParams {
  const searchQuery = firstSearchParam(params.q);

  return {
    status: firstSearchParam(params.status) || "all",
    searchQuery,
    query: searchQuery.trim().toLowerCase(),
    from: firstSearchParam(params.from),
    to: firstSearchParam(params.to),
    page: parsePageParam(params.page),
  };
}

/**
 * Composite listings segment covering both statuses that take a gown off the
 * marketplace. It exists so the overview's off-market card can link to exactly
 * what it lists: the two single-status pills only ever match one of them.
 */
export const ADMIN_OFF_MARKET_STATUS = "off_market";

const OFF_MARKET_STATUSES = ["suspended", "removed"];

export function matchesListingStatus(segment: string, status: string): boolean {
  if (segment === "all") return true;
  if (segment === ADMIN_OFF_MARKET_STATUS) {
    return OFF_MARKET_STATUSES.includes(status);
  }
  return status === segment;
}

/**
 * Age-based segments. Each pairs an optional status with a rolling window, so
 * the URL carries the QUESTION (`?status=stale_active`) rather than the answer
 * a date filter happened to produce on the day it was built. An absolute
 * `?to=2026-07-01` means "older than 30 days" only on the day it is generated;
 * these are recomputed against `asOf` on every request, so a bookmark keeps
 * meaning what it says.
 */
export const ADMIN_NEW_WEEK_SEGMENT = "new_week";
export const ADMIN_STALE_ACTIVE_SEGMENT = "stale_active";
export const ADMIN_STUCK_PAYMENT_SEGMENT = "stuck_payment";

type AgeSegmentRule = {
  /** Listing status the segment also requires, if any. */
  status?: string;
  days: number;
  /** `older` looks back past the cutoff; `newer` looks forward from it. */
  side: "older" | "newer";
};

const AGE_SEGMENTS: Record<string, AgeSegmentRule> = {
  [ADMIN_NEW_WEEK_SEGMENT]: { days: NEW_LISTING_WINDOW_DAYS, side: "newer" },
  [ADMIN_STALE_ACTIVE_SEGMENT]: {
    status: "active",
    days: STALE_ACTIVE_DAYS,
    side: "older",
  },
  [ADMIN_STUCK_PAYMENT_SEGMENT]: {
    status: "pending_payment",
    days: STUCK_PENDING_PAYMENT_DAYS,
    side: "older",
  },
};

/** The cutoff date for an age segment, as the yyyy-mm-dd the date filter uses. */
export function queueCutoffDate(days: number, asOf: string): string {
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A `to` bound covers the whole end day, not midnight on it. */
function endOfDayMs(date: string): number {
  return new Date(date).getTime() + DAY_MS - 1;
}

/**
 * The cutoff timestamp an age segment compares against, or null for a plain
 * status segment. Depends only on the segment and `asOf`, so callers filtering
 * a list resolve it once instead of per row.
 */
function segmentCutoffMs(rule: AgeSegmentRule, asOf: string): number {
  const cutoff = queueCutoffDate(rule.days, asOf);
  return rule.side === "older" ? endOfDayMs(cutoff) : new Date(cutoff).getTime();
}

/**
 * The one place a listing is tested against a segment. Plain statuses fall
 * through to `matchesListingStatus`; age segments add the rolling window, so
 * an overview card and the listings page it links to cannot disagree.
 */
export function matchesListingSegment(
  segment: string,
  listing: { status: string; created_at: string },
  asOf: string,
): boolean {
  const rule = AGE_SEGMENTS[segment];
  if (!rule) return matchesListingStatus(segment, listing.status);
  if (rule.status && listing.status !== rule.status) return false;

  const createdMs = new Date(listing.created_at).getTime();
  const cutoffMs = segmentCutoffMs(rule, asOf);

  return rule.side === "older" ? createdMs <= cutoffMs : createdMs >= cutoffMs;
}

/** Inclusive day range: `to` covers the whole end day, not midnight on it. */
export function filterByDateRange<T>(
  items: T[],
  { from, to }: Pick<AdminListParams, "from" | "to">,
  getDate: (item: T) => string,
): T[] {
  if (!from && !to) return items;

  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? endOfDayMs(to) : Infinity;

  return items.filter((item) => {
    const ms = new Date(getDate(item)).getTime();
    return ms >= fromMs && ms <= toMs;
  });
}

/**
 * Newest first. Every admin list orders this way, so an overview card and the
 * page its link lands on show the same rows in the same order. Timestamps are
 * parsed once per row rather than on every comparison.
 */
export function sortByCreatedDesc<T extends { created_at: string }>(
  items: T[],
): T[] {
  return items
    .map((item) => ({ item, ms: new Date(item.created_at).getTime() }))
    .sort((a, b) => b.ms - a.ms)
    .map(({ item }) => item);
}

/**
 * Paginates the filtered rows and rebuilds the querystring every link on the
 * page is built from. Phase 3 swaps the in-memory paginate for a range query;
 * the params and the querystring are unaffected by that.
 */
export function buildAdminListResult<T>(
  items: T[],
  params: AdminListParams,
): AdminListResult<T> {
  const { rows, totalCount, totalPages, page } = paginateFixtures(
    items,
    params.page,
    ADMIN_PAGE_SIZE,
  );

  const current = new URLSearchParams();
  if (params.status !== "all") current.set("status", params.status);
  if (params.searchQuery) current.set("q", params.searchQuery);
  if (params.from) current.set("from", params.from);
  if (params.to) current.set("to", params.to);
  if (page > 1) current.set("page", String(page));

  return { rows, totalCount, totalPages, page, params, current };
}
