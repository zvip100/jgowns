import { canonicalBrowseQueryString } from "@/lib/browse-params";
import {
  GOWN_CATEGORIES,
  type GownCategoryId,
  type ListingsFilters,
  type PageSearchParams,
} from "@/lib/types";

const ALLOWED_CATEGORY = new Set<string>(GOWN_CATEGORIES.map((c) => c.id));

function firstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(params: PageSearchParams): ListingsFilters {
  const minPriceValue = firstParamValue(params.minPrice);
  const maxPriceValue = firstParamValue(params.maxPrice);
  const rawCategory = firstParamValue(params.category);
  const category =
    rawCategory && ALLOWED_CATEGORY.has(rawCategory)
      ? (rawCategory as GownCategoryId)
      : undefined;

  return {
    category,
    size: firstParamValue(params.size),
    color: firstParamValue(params.color),
    location: firstParamValue(params.location),
    cond: firstParamValue(params.cond),
    minPrice: minPriceValue ? Number(minPriceValue) : undefined,
    maxPrice: maxPriceValue ? Number(maxPriceValue) : undefined,
  };
}

export function hasActiveBrowseFilters(filters: ListingsFilters): boolean {
  return !!(
    filters.category ||
    filters.size ||
    filters.color ||
    filters.location ||
    filters.cond ||
    Number.isFinite(filters.minPrice) ||
    Number.isFinite(filters.maxPrice)
  );
}

/** Canonical filter query for `?back=` on `/browse/[id]` (no `/browse` prefix). */
export function buildBrowseBackQuery(filters: ListingsFilters): string {
  const filterParams = new URLSearchParams();

  if (filters.category) filterParams.set("category", filters.category);
  if (filters.size) filterParams.set("size", filters.size);
  if (filters.color) filterParams.set("color", filters.color);
  if (filters.location) filterParams.set("location", filters.location);
  if (filters.cond) filterParams.set("cond", filters.cond);
  if (Number.isFinite(filters.minPrice))
    filterParams.set("minPrice", String(filters.minPrice));
  if (Number.isFinite(filters.maxPrice))
    filterParams.set("maxPrice", String(filters.maxPrice));

  return canonicalBrowseQueryString(filterParams);
}
