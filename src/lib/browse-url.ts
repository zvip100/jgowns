import {
  canonicalBrowseQueryString,
  formatBrowseParamList,
  toPageSearchParams,
} from "@/lib/browse-params";
import { formatBrowsePage } from "@/lib/browse-pagination";
import { parseBrowseFilters } from "@/lib/browse-filters";
import type { BrowseFilters } from "@/lib/types";
import { firstParam } from "@/lib/utils";

function filtersToSearchParams(
  filters: BrowseFilters,
  page?: number,
): URLSearchParams {
  const p = new URLSearchParams();

  if (filters.category) p.set("category", filters.category);
  if (filters.size?.length) p.set("size", formatBrowseParamList(filters.size));
  if (filters.color?.length) p.set("color", formatBrowseParamList(filters.color));
  if (filters.location?.length)
    p.set("location", formatBrowseParamList(filters.location));
  if (filters.cond) p.set("cond", filters.cond);
  if (Number.isFinite(filters.minPrice))
    p.set("minPrice", String(filters.minPrice));
  if (Number.isFinite(filters.maxPrice))
    p.set("maxPrice", String(filters.maxPrice));

  const pageValue = formatBrowsePage(page ?? 1);
  if (pageValue) p.set("page", pageValue);

  return p;
}

/** Canonical query string — filters and optional page (for `?back=` on listing detail). */
export function browseQueryString(filters: BrowseFilters, page = 1): string {
  return canonicalBrowseQueryString(filtersToSearchParams(filters, page));
}

/** Full browse path — e.g. `/browse?category=bridal`. */
export function browseHref(filters: BrowseFilters, page = 1): string {
  const qs = browseQueryString(filters, page);
  return qs ? `/browse?${qs}` : "/browse";
}

/** Legacy `back` search param (query or `/browse?…`) → validated browse path. */
export function browseHrefFromBack(back: string | undefined): string {
  if (!back?.trim()) return "/browse";

  let trimmed = back.trim().replace(/^\?/, "");
  if (trimmed.startsWith("/browse?")) {
    trimmed = trimmed.slice("/browse?".length);
  } else if (trimmed.startsWith("/browse")) {
    trimmed = trimmed.slice("/browse".length).replace(/^\?/, "");
  }

  const params = toPageSearchParams(new URLSearchParams(trimmed));
  const filters = parseBrowseFilters(params);
  const pageRaw = firstParam(params.page);
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;

  return browseHref(filters, Number.isFinite(page) && page > 1 ? page : 1);
}
