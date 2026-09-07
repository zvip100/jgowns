import { ADMIN_PAGE_SIZE, NEW_LISTING_WINDOW_DAYS, STALE_ACTIVE_DAYS, STUCK_PENDING_PAYMENT_DAYS } from "./constants";
import { ADMIN_ACTOR_ROLES } from "./types";

import { firstParam } from "@/lib/utils";

import type { PageSearchParams } from "@/lib/types";

/**
 * The URL contract every admin list page shares, and the pagination shape both
 * data sources produce. It lives in `lib` rather than the route group because
 * `src/lib/queries/admin/*` has to build the same result from a real query that
 * the demo fixtures build in memory, and a query module must not import from
 * the app tree.
 */
export type AdminListParams = {
  /** Segment pill value. "all" when nothing is selected. */
  status: string;
  /** Raw search box value, kept verbatim for the URL and the input. */
  searchQuery: string;
  /** Normalized search value, for matching only. */
  query: string;
  /**
   * Actor role, audit log only. "all" when nothing is selected; a hand-typed
   * value that names no real role falls back to "all" rather than returning an
   * empty table.
   */
  actor: string;
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

export function firstSearchParam(value: string | string[] | undefined): string {
  return firstParam(value) ?? "";
}

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = firstSearchParam(value);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Every admin list page reads the same params off the URL. */
export function parseAdminListParams(params: PageSearchParams): AdminListParams {
  const searchQuery = firstSearchParam(params.q);
  const actor = firstSearchParam(params.actor);

  return {
    status: firstSearchParam(params.status) || "all",
    searchQuery,
    query: searchQuery.trim().toLowerCase(),
    actor: (ADMIN_ACTOR_ROLES as string[]).includes(actor) ? actor : "all",
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

export const OFF_MARKET_STATUSES = ["suspended", "removed"];

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

export type AgeSegmentRule = {
  /** Listing status the segment also requires, if any. */
  status?: string;
  days: number;
  /** `older` looks back past the cutoff; `newer` looks forward from it. */
  side: "older" | "newer";
};

export const AGE_SEGMENTS: Record<string, AgeSegmentRule> = {
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

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A `to` bound covers the whole end day, not midnight on it. */
export function endOfDayMs(date: string): number {
  return new Date(date).getTime() + DAY_MS - 1;
}

/**
 * The cutoff timestamp an age segment compares against. Both data sources
 * resolve it from here, so an in-memory match and a SQL predicate cannot drift.
 */
export function segmentCutoffMs(rule: AgeSegmentRule, asOf: string): number {
  const cutoff = queueCutoffDate(rule.days, asOf);
  return rule.side === "older" ? endOfDayMs(cutoff) : new Date(cutoff).getTime();
}

/** The same cutoff as an ISO string, for a `gte`/`lte` against a timestamptz. */
export function segmentCutoffIso(rule: AgeSegmentRule, asOf: string): string {
  return new Date(segmentCutoffMs(rule, asOf)).toISOString();
}

/**
 * Rebuilds the querystring every link on the page is built from. Kept separate
 * from the result builders so the demo and real paths emit identical URLs.
 */
export function adminListQuery(
  params: AdminListParams,
  page: number,
): URLSearchParams {
  const current = new URLSearchParams();
  if (params.status !== "all") current.set("status", params.status);
  if (params.searchQuery) current.set("q", params.searchQuery);
  if (params.actor !== "all") current.set("actor", params.actor);
  if (params.from) current.set("from", params.from);
  if (params.to) current.set("to", params.to);
  if (page > 1) current.set("page", String(page));
  return current;
}

export function totalPagesFor(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

/** Zero-based row range for the requested page, for a Supabase `.range()`. */
export function pageRange(page: number): { from: number; to: number } {
  const start = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;
  return { from: start, to: start + ADMIN_PAGE_SIZE - 1 };
}

/** Assembles the result a query already paginated server-side. */
export function adminListResult<T>(
  rows: T[],
  totalCount: number,
  params: AdminListParams,
): AdminListResult<T> {
  const totalPages = totalPagesFor(totalCount);
  const page = clampPage(params.page, totalPages);

  return {
    rows,
    totalCount,
    totalPages,
    page,
    params,
    current: adminListQuery(params, page),
  };
}

/**
 * Runs one page of a server-paginated admin query. A page number past the end
 * (a stale bookmark, or rows removed since the link was made) refetches the
 * last real page instead of rendering an empty table, so a real query lands on
 * the same row set the in-memory path would have clamped to.
 */
export async function fetchAdminListPage<T>(
  params: AdminListParams,
  run: (range: { from: number; to: number }) => Promise<{
    rows: T[];
    count: number;
  }>,
): Promise<AdminListResult<T>> {
  const first = await run(pageRange(params.page));
  const totalPages = totalPagesFor(first.count);

  if (first.count === 0 || params.page <= totalPages) {
    return adminListResult(first.rows, first.count, params);
  }

  const clamped = await run(pageRange(totalPages));
  return adminListResult(clamped.rows, first.count, params);
}

/** Paginates an already-filtered in-memory list (the demo data path). */
export function paginateAdminList<T>(
  items: T[],
  params: AdminListParams,
): AdminListResult<T> {
  const totalPages = totalPagesFor(items.length);
  const page = clampPage(params.page, totalPages);
  const start = (page - 1) * ADMIN_PAGE_SIZE;

  return {
    rows: items.slice(start, start + ADMIN_PAGE_SIZE),
    totalCount: items.length,
    totalPages,
    page,
    params,
    current: adminListQuery(params, page),
  };
}
