import type { PageSearchParams } from "@/lib/types";

/** Navigation params — driven by the secondary navbar (category rail). */
export const BROWSE_NAV_PARAMS = ["category"] as const;
/** Filter params — driven by the FilterBar. */
export const BROWSE_FILTER_PARAMS = [
  "size",
  "color",
  "location",
  "cond",
  "minPrice",
  "maxPrice",
] as const;

/** Pagination — driven by BrowsePagination links. */
export const BROWSE_PAGINATION_PARAMS = ["page"] as const;

/** Stable ordering for /browse query strings (nav first, then filters, then page). */
export const BROWSE_PARAM_ORDER = [
  ...BROWSE_NAV_PARAMS,
  ...BROWSE_FILTER_PARAMS,
  ...BROWSE_PAGINATION_PARAMS,
] as const;

/** Split a browse filter param into discrete values (comma-separated or repeated keys). */
export function parseBrowseParamList(
  value: string | string[] | null | undefined,
): string[] {
  if (value == null || value === "") return [];
  const parts = Array.isArray(value)
    ? value.flatMap((v) => v.split(","))
    : value.split(",");
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

/** Encode multiple filter values for a single query param. */
export function formatBrowseParamList(values: string[]): string {
  return [...new Set(values.map((s) => s.trim()).filter(Boolean))].join(",");
}

export function canonicalBrowseQueryString(params: URLSearchParams): string {
  const canonical = new URLSearchParams();

  for (const key of BROWSE_PARAM_ORDER) {
    const value = params.get(key);
    if (!value) continue;
    // Omit default page=1 for cleaner canonical URLs.
    if (key === "page" && value === "1") continue;
    canonical.set(key, value);
  }
  return canonical.toString();
}

/** `URLSearchParams` → {@link PageSearchParams} for browse query keys. */
export function toPageSearchParams(params: URLSearchParams): PageSearchParams {
  const resolved: PageSearchParams = {};
  for (const key of BROWSE_PARAM_ORDER) {
    const values = params.getAll(key);
    if (values.length === 0) continue;
    resolved[key] = values.length === 1 ? values[0] : values;
  }
  return resolved;
}
