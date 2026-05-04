/** Stable ordering for /browse query strings (category rail + FilterBar). */
export const BROWSE_PARAM_ORDER = [
  "category",
  "size",
  "color",
  "location",
  "cond",
  "minPrice",
  "maxPrice",
] as const;

export function canonicalBrowseQueryString(params: URLSearchParams): string {
  const canonical = new URLSearchParams();
  for (const key of BROWSE_PARAM_ORDER) {
    const value = params.get(key);
    if (value) canonical.set(key, value);
  }
  return canonical.toString();
}

/**
 * Builds `/browse` or `/browse?…` from the listing detail `back` search param.
 * `back` is filter query only (e.g. `category=bride`); also accepts legacy
 * values that included `/browse?…`.
 */
export function browseHrefFromBackParam(back: string | undefined): string {
  if (!back?.trim()) return "/browse";
  let trimmed = back.trim().replace(/^\?/, "");
  if (trimmed.startsWith("/browse?")) {
    trimmed = trimmed.slice("/browse?".length);
  } else if (trimmed.startsWith("/browse")) {
    trimmed = trimmed.slice("/browse".length).replace(/^\?/, "");
  }
  const incoming = new URLSearchParams(trimmed);
  const safe = canonicalBrowseQueryString(incoming);
  return safe ? `/browse?${safe}` : "/browse";
}

/** Rebuild URLSearchParams from a resolved /browse `searchParams` object. */
export function browseParamsToURLSearchParams(
  resolved: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of BROWSE_PARAM_ORDER) {
    const raw = resolved[key];
    if (raw === undefined) continue;
    const val = Array.isArray(raw) ? raw[0] : raw;
    if (val) p.set(key, val);
  }
  return p;
}
