import {
  canonicalBrowseQueryString,
  formatBrowseParamList,
  toPageSearchParams,
} from "@/lib/browse-params";
import { parseBrowseFilters } from "@/lib/browse-filters";
import type { BrowseFilters } from "@/lib/types";

function filtersToSearchParams(filters: BrowseFilters): URLSearchParams {
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

  return p;
}

/** Canonical query string only — e.g. for `?back=` on listing detail. */
export function filtersToQuery(filters: BrowseFilters): string {
  return canonicalBrowseQueryString(filtersToSearchParams(filters));
}

/** Full browse path — e.g. `/browse?category=bridal`. */
export function browseHref(filters: BrowseFilters): string {
  const qs = filtersToQuery(filters);
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

  return browseHref(parseBrowseFilters(toPageSearchParams(new URLSearchParams(trimmed))));
}
