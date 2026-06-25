"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  BROWSE_FILTER_PARAMS,
  BROWSE_NAV_PARAMS,
  canonicalBrowseQueryString,
  countActiveBrowseFilters,
  formatBrowseParamList,
  parseBrowseParamList,
  toggleParamValue,
} from "@/lib/browse-params";
import {
  getBrowseAllowedSizes,
  getSizeFilterOptions,
  type SizeOption,
} from "@/lib/gown-sizes";
import { GOWN_CATEGORIES, type GownCategoryId } from "@/lib/types";

type LocalFilters = {
  size: string;
  color: string;
  location: string;
  cond: string;
  minPrice: string;
  maxPrice: string;
};

type MultiKey = "size" | "color" | "location";

export type BrowseFiltersController = {
  local: LocalFilters;
  sizeFilterOptions: readonly SizeOption[];
  hasFilters: boolean;
  activeCount: number;
  currentMin: number;
  currentMax: number;
  priceActive: boolean;
  openAccordions: string[];
  setOpenAccordions: (value: string[]) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  updateFilter: (key: keyof LocalFilters, value: string) => void;
  toggleMulti: (key: MultiKey, token: string) => void;
  syncPrices: (nextMin: number, nextMax: number) => void;
  clearAll: () => void;
  multiFilterCount: (key: MultiKey) => number;
};

type UseBrowseFiltersOptions = {
  variant: "rail" | "drawer";
  minBound: number;
  maxBound: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useBrowseFilters({
  variant,
  minBound,
  maxBound,
}: UseBrowseFiltersOptions): BrowseFiltersController {
  const router = useRouter();
  const params = useSearchParams();
  const isDrawer = variant === "drawer";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // Local state prevents focus loss while URL-backed filters update.
  const [local, setLocal] = useState<LocalFilters>({
    size: params.get("size") ?? "",
    color: params.get("color") ?? "",
    location: params.get("location") ?? "",
    cond: params.get("cond") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
  });

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryParam = params.get("category") ?? "";
  const activeCategory = GOWN_CATEGORIES.some((c) => c.id === categoryParam)
    ? (categoryParam as GownCategoryId)
    : undefined;
  const sizeFilterOptions = getSizeFilterOptions(activeCategory ?? null);
  const allowedSizes = useMemo(
    () => getBrowseAllowedSizes(activeCategory),
    [activeCategory],
  );
  const allowedSizeSet = useMemo(() => new Set(allowedSizes), [allowedSizes]);

  // Resync when navigation changes outside this component.
  useEffect(() => {
    const rawSize = params.get("size") ?? "";
    const selected = parseBrowseParamList(rawSize || null);
    const valid = selected.filter((s) => allowedSizeSet.has(s));
    const sizeValue = formatBrowseParamList(valid);

    setLocal({
      size: sizeValue,
      color: params.get("color") ?? "",
      location: params.get("location") ?? "",
      cond: params.get("cond") ?? "",
      minPrice: params.get("minPrice") ?? "",
      maxPrice: params.get("maxPrice") ?? "",
    });

    if (sizeValue !== rawSize) {
      const p = new URLSearchParams(params.toString());
      if (sizeValue) p.set("size", sizeValue);
      else p.delete("size");
      p.delete("page");
      const qs = canonicalBrowseQueryString(p);
      router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
    }
  }, [params, allowedSizes, router]);

  const hasFilters = BROWSE_FILTER_PARAMS.some((k) => params.has(k));
  const activeCount = countActiveBrowseFilters(params);

  const pushURL = (key: string, value: string) => {
    const p = new URLSearchParams(paramsRef.current.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    const qs = canonicalBrowseQueryString(p);
    router.push(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  };

  const pushURLMany = (entries: Array<[string, string]>) => {
    const p = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of entries) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    p.delete("page");
    const qs = canonicalBrowseQueryString(p);
    router.push(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  };

  const updateFilter = (key: keyof LocalFilters, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    pushURL(key, value);
  };

  const toggleMulti = (key: MultiKey, token: string) => {
    const next = toggleParamValue(
      parseBrowseParamList(local[key] || null),
      token,
    );
    updateFilter(key, formatBrowseParamList(next));
  };

  // Debounce URL pushes while dragging the price slider.
  const syncPrices = (nextMin: number, nextMax: number) => {
    const lo = clamp(nextMin, minBound, maxBound);
    const hi = clamp(nextMax, minBound, maxBound);
    const fixedMin = Math.min(lo, hi);
    const fixedMax = Math.max(lo, hi);

    const minValue = fixedMin === minBound ? "" : String(fixedMin);
    const maxValue = fixedMax === maxBound ? "" : String(fixedMax);

    setLocal((prev) => ({ ...prev, minPrice: minValue, maxPrice: maxValue }));

    if (priceTimer.current) clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => {
      pushURLMany([
        ["minPrice", minValue],
        ["maxPrice", maxValue],
      ]);
    }, 300);
  };

  const clearAll = () => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    if (isDrawer) setDrawerOpen(false);
    setOpenAccordions([]);

    // Preserve nav params owned by the category navbar.
    const p = new URLSearchParams();

    for (const k of BROWSE_NAV_PARAMS) {
      const v = paramsRef.current.get(k);
      if (v) p.set(k, v);
    }
    const qs = canonicalBrowseQueryString(p);
    router.push(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  };

  const currentMin = local.minPrice
    ? clamp(Number(local.minPrice), minBound, maxBound)
    : minBound;
  const currentMax = local.maxPrice
    ? clamp(Number(local.maxPrice), minBound, maxBound)
    : maxBound;

  const priceActive = !!(local.minPrice || local.maxPrice);

  const multiFilterCount = (key: MultiKey) =>
    parseBrowseParamList(local[key] || null).length;

  return {
    local,
    sizeFilterOptions,
    hasFilters,
    activeCount,
    currentMin,
    currentMax,
    priceActive,
    openAccordions,
    setOpenAccordions,
    drawerOpen,
    setDrawerOpen,
    updateFilter,
    toggleMulti,
    syncPrices,
    clearAll,
    multiFilterCount,
  };
}
