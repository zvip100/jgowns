import {
  BROWSE_PARAM_ORDER,
  canonicalBrowseQueryString,
} from "@/lib/browse-params";
import type { PageSearchParams } from "@/lib/types";
import { firstParam } from "@/lib/utils";

export const BROWSE_PAGE_SIZE = 8;

const MAX_PAGE = 10_000;

/** Raw `/browse` `page` searchParam → validated 1-based page index. */
export function parseBrowsePage(params: PageSearchParams): number {
  const raw = firstParam(params.page);
  if (!raw || !/^\d+$/.test(raw)) return 1;

  const n = Number.parseInt(raw, 10);
  if (n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

/** Serialize page for URL; omit when page 1. */
export function formatBrowsePage(page: number): string | undefined {
  if (page <= 1) return undefined;
  return String(page);
}

export function totalPagesFromCount(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

/** When the URL page is past the last page, return 1 (redirect target); else null. */
export function browsePageRedirectTarget(
  page: number,
  totalPages: number,
  totalCount: number,
): number | null {
  if (totalCount <= 0 || page <= 1) return null;
  if (totalPages > 0 && page > totalPages) return 1;
  return null;
}

/** Preserve current browse filters; set `targetPage` (omits page when 1). */
export function browsePageHref(
  searchParams: PageSearchParams,
  targetPage: number,
): string {
  const p = new URLSearchParams();

  for (const key of BROWSE_PARAM_ORDER) {
    if (key === "page") continue;
    const val = searchParams[key];
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) p.append(key, v);
    } else {
      p.set(key, val);
    }
  }

  const pageStr = formatBrowsePage(targetPage);
  if (pageStr) p.set("page", pageStr);

  const qs = canonicalBrowseQueryString(p);
  return qs ? `/browse?${qs}` : "/browse";
}

export type PageNavItem = number | "ellipsis";

/** Compact page list: current ±2 with ellipsis gaps. */
export function getBrowsePageNavItems(
  current: number,
  total: number,
): PageNavItem[] {
  if (total <= 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items: PageNavItem[] = [1];
  if (current > 3) items.push("ellipsis");

  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) items.push(i);

  if (current < total - 2) items.push("ellipsis");
  items.push(total);

  return items;
}
