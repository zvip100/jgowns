import {
  AGE_SEGMENTS,
  ADMIN_OFF_MARKET_STATUS,
  OFF_MARKET_STATUSES,
  endOfDayMs,
  segmentCutoffMs,
} from "@/lib/admin/list";

import type { AdminListParams } from "@/lib/admin/list";

/**
 * In-memory counterparts to the SQL predicates in `src/lib/queries/admin/*`.
 * These serve the demo data path and the overview's fixture-fed queue cards;
 * both sides resolve their windows from the shared rules in `lib/admin/list`,
 * so a card and the page its link lands on cannot disagree.
 */
export function matchesListingStatus(segment: string, status: string): boolean {
  if (segment === "all") return true;
  if (segment === ADMIN_OFF_MARKET_STATUS) {
    return OFF_MARKET_STATUSES.includes(status);
  }
  return status === segment;
}

/**
 * The one place a listing is tested against a segment. Plain statuses fall
 * through to `matchesListingStatus`; age segments add the rolling window.
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
 * Newest first, matching the `order(created_at, desc)` every real admin query
 * runs. Timestamps are parsed once per row rather than on every comparison.
 */
export function sortByCreatedDesc<T extends { created_at: string }>(
  items: T[],
): T[] {
  return items
    .map((item) => ({ item, ms: new Date(item.created_at).getTime() }))
    .sort((a, b) => b.ms - a.ms)
    .map(({ item }) => item);
}
