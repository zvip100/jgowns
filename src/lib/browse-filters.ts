import { parseBrowseParamList } from "@/lib/browse-params";
import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_SIZES,
  LOCATIONS,
  type BrowseFilters,
  type GownCategoryId,
  type PageSearchParams,
} from "@/lib/types";

/** Browse `cond` URL values (FilterBar pills; not all DB `GOWN_CONDITIONS`). */
export const BROWSE_COND_VALUES = ["no-alterations", "Brand New"] as const;

const GOWN_CATEGORY_IDS = GOWN_CATEGORIES.map((c) => c.id) as readonly GownCategoryId[];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function paramList(value: string | string[] | undefined): string[] | undefined {
  const parsed = parseBrowseParamList(value);
  return parsed.length > 0 ? parsed : undefined;
}

function pickAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function pickAllowedMany<T extends string>(
  values: string[] | undefined,
  allowed: readonly T[],
): T[] | undefined {
  if (!values?.length) return undefined;
  const allowedSet = new Set<string>(allowed);
  const filtered = values.filter((v): v is T => allowedSet.has(v));
  return filtered.length > 0 ? filtered : undefined;
}

function parsePrice(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Raw `/browse` searchParams → validated filter state for queries and links. */
export function parseBrowseFilters(params: PageSearchParams): BrowseFilters {
  return {
    category: pickAllowed(firstParam(params.category), GOWN_CATEGORY_IDS),
    size: pickAllowedMany(paramList(params.size), GOWN_SIZES),
    color: pickAllowedMany(paramList(params.color), GOWN_COLORS),
    location: pickAllowedMany(paramList(params.location), LOCATIONS),
    cond: pickAllowed(paramList(params.cond)?.[0], BROWSE_COND_VALUES),
    minPrice: parsePrice(firstParam(params.minPrice)),
    maxPrice: parsePrice(firstParam(params.maxPrice)),
  };
}

export function hasBrowseFilters(filters: BrowseFilters): boolean {
  return !!(
    filters.category ||
    filters.size?.length ||
    filters.color?.length ||
    filters.location?.length ||
    filters.cond ||
    Number.isFinite(filters.minPrice) ||
    Number.isFinite(filters.maxPrice)
  );
}
