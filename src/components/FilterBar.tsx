"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, SlidersHorizontal, X } from "lucide-react";

import {
  BROWSE_FILTER_PARAMS,
  BROWSE_NAV_PARAMS,
  canonicalBrowseQueryString,
} from "@/lib/browse-params";
import { GOWN_COLORS, GOWN_SIZES, LOCATIONS } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// URL semantics for the `cond` param:
//   "":               All conditions
//   "no-alterations": Brand New + Perfect Condition
//   "Brand New":      Brand New only

type FilterBarProps = {
  variant: "rail" | "drawer";
  minBound: number;
  maxBound: number;
  /** Desktop rail only: parent removes the rail column so listings expand. */
  onCollapseRail?: () => void;
};

const CONDITION_LABEL: Record<string, string> = {
  "no-alterations": "Ready to Wear",
  "Brand New": "Brand New",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}


const triggerClass =
  "group/accordion-trigger relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3.5 text-left text-sm font-medium text-[#5a4738] outline-none transition-colors hover:bg-white/55 hover:no-underline focus-visible:bg-white/60 focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[state=open]:bg-white/55";

const itemClass =
  "rounded-xl border-0 not-last:border-b not-last:border-[#e6d8c3]/70";

const labelClass =
  "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#6f5947]";

const activeBadgeClass =
  "rounded-full border-0 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_4px_12px_rgba(166,120,65,0.35)]";

const idleBadgeClass =
  "rounded-full border border-[#dccbb5] bg-white/55 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.13em] text-[#a08770]";

const triggerRowClass =
  "flex flex-1 items-center justify-between gap-3 pr-2 min-w-0";

const pillClass =
  "inline-flex min-w-[2.4rem] items-center justify-center rounded-full border border-[#e0cfb6] bg-white/45 px-3 py-1.5 text-[0.72rem] font-medium text-[#6a5544] outline-none transition-colors hover:bg-white/80 hover:text-[#3f3023] focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[active=true]:border-[#a67841] data-[active=true]:bg-[linear-gradient(180deg,#c49a68,#a67841)] data-[active=true]:text-white data-[active=true]:shadow-[0_8px_20px_rgba(166,120,65,0.3)] data-[active=true]:[text-shadow:0_1px_0_rgba(74,49,21,0.25)]";

const pillRowClass = "flex flex-wrap gap-1.5";

export default function FilterBar({
  variant,
  minBound,
  maxBound,
  onCollapseRail,
}: FilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const isDrawer = variant === "drawer";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // Fully controlled local state to prevent focus loss on URL pushes.
  const [local, setLocal] = useState({
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

  // Sync local state when URL changes externally (clear-all, browser back/forward)
  useEffect(() => {
    setLocal({
      size: params.get("size") ?? "",
      color: params.get("color") ?? "",
      location: params.get("location") ?? "",
      cond: params.get("cond") ?? "",
      minPrice: params.get("minPrice") ?? "",
      maxPrice: params.get("maxPrice") ?? "",
    });
  }, [params]);

  const hasFilters = BROWSE_FILTER_PARAMS.some((k) => params.has(k));

  const pushURL = (key: string, value: string) => {
    const p = new URLSearchParams(paramsRef.current.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    const qs = canonicalBrowseQueryString(p);
    router.push(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  };

  const pushURLMany = (entries: Array<[string, string]>) => {
    const p = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of entries) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    const qs = canonicalBrowseQueryString(p);
    router.push(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  };

  const updateFilter = (key: keyof typeof local, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    pushURL(key, value);
  };

  // Debounced price commit so dragging the slider doesn't spam navigations.
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
    
    // Preserve nav params (category) — the secondary navbar owns those.
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
  const priceBadgeText = priceActive
    ? `$${currentMin.toLocaleString()} – $${currentMax.toLocaleString()}`
    : "Any";

  const renderTriggerBadge = (active: boolean, text: string) => (
    <Badge
      variant='outline'
      className={cn(active ? activeBadgeClass : idleBadgeClass)}
    >
      {text || "All"}
    </Badge>
  );

  const renderPillRow = (
    key: keyof typeof local,
    options: ReadonlyArray<{ value: string; label: string }>,
    ariaLabel: string,
  ) => {
    const current = local[key];
    return (
      <div role='group' aria-label={ariaLabel} className={pillRowClass}>
        <button
          type='button'
          onClick={() => updateFilter(key, "")}
          data-active={!current}
          aria-pressed={!current}
          className={pillClass}
        >
          All
        </button>
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type='button'
              onClick={() => updateFilter(key, active ? "" : opt.value)}
              data-active={active}
              aria-pressed={active}
              className={pillClass}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  };

  const panel = (
    <div
      className={cn(
        "surface-panel hairline px-4 py-4 sm:px-5",
        isDrawer
          ? "rounded-[1.75rem]"
          : // Rail variant: panel itself is NOT scrollable — it just takes
          // its natural content height and grows/shrinks as accordions
          // open and close. The OUTER sticky wrapper below owns the
          // scroll. `[box-shadow:inset_…]!` keeps the surface clean of
          // the soft drop shadow `.surface-panel` would otherwise paint,
          // while preserving the 1px white inset highlight.
          "rounded-b-[1.75rem] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.74)]!",
      )}
    >
      <div className='mb-3 flex items-center justify-between gap-2 px-1'>
        <p className='font-display text-lg text-[#47362a] sm:text-xl'>Filters</p>
        <div className='flex items-center gap-2'>
          {hasFilters && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={clearAll}
              className='rounded-full border-[#d4c2ad] bg-white/60 text-[0.63rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:border-[#c9a880] hover:bg-white hover:text-[#5a4537]'
            >
              <X data-icon='inline-start' />
              Clear
            </Button>
          )}
          {onCollapseRail && !isDrawer && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={onCollapseRail}
              className='rounded-full border-[#d4c2ad] bg-white/70 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#7a6350] hover:bg-white'
            >
              <ChevronLeft data-icon='inline-start' />
              Hide
            </Button>
          )}
        </div>
      </div>
      <div className='soft-divider mb-2' />

      <Accordion
        type='multiple'
        value={openAccordions}
        onValueChange={setOpenAccordions}
        className='flex w-full flex-col gap-1.5'
      >
        <AccordionItem value='size' className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className={triggerRowClass}>
              <span className={labelClass}>Size</span>
              {renderTriggerBadge(!!local.size, local.size)}
            </span>
          </AccordionTrigger>
          <AccordionContent className='px-1 pb-3'>
            {renderPillRow(
              "size",
              GOWN_SIZES.map((s) => ({ value: s, label: s })),
              "Size",
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='color' className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className={triggerRowClass}>
              <span className={labelClass}>Color</span>
              {renderTriggerBadge(!!local.color, local.color)}
            </span>
          </AccordionTrigger>
          <AccordionContent className='px-1 pb-3'>
            {renderPillRow(
              "color",
              GOWN_COLORS.map((c) => ({ value: c, label: c })),
              "Color",
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='location' className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className={triggerRowClass}>
              <span className={labelClass}>Location</span>
              {renderTriggerBadge(!!local.location, local.location)}
            </span>
          </AccordionTrigger>
          <AccordionContent className='px-1 pb-3'>
            {renderPillRow(
              "location",
              LOCATIONS.map((l) => ({ value: l, label: l })),
              "Location",
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='condition' className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className={triggerRowClass}>
              <span className={labelClass}>Condition</span>
              {renderTriggerBadge(
                !!local.cond,
                CONDITION_LABEL[local.cond] ?? local.cond
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className='px-1 pb-3'>
            {renderPillRow(
              "cond",
              [
                { value: "no-alterations", label: "Ready to Wear" },
                { value: "Brand New", label: "Brand New Only" },
              ],
              "Condition",
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value='price' className={itemClass}>
          <AccordionTrigger className={triggerClass}>
            <span className={triggerRowClass}>
              <span className={labelClass}>Price</span>
              {renderTriggerBadge(priceActive, priceBadgeText)}
            </span>
          </AccordionTrigger>
          <AccordionContent className='px-1 pt-1 pb-3'>
            <div className='rounded-2xl border border-[#d9c9b6] bg-white/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'>
              <p className='text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462]'>
                Range
              </p>
              <p className='mt-1 text-sm font-semibold text-[#6a5442]'>
                ${currentMin.toLocaleString()} – ${currentMax.toLocaleString()}
              </p>
              <div className='mt-3'>
                <Slider
                  min={minBound}
                  max={maxBound}
                  step={50}
                  value={[currentMin, currentMax]}
                  onValueChange={([lo, hi]) => syncPrices(lo, hi)}
                  aria-label='Price range'
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  if (!isDrawer) {
    // Desktop rail: sticky-positioned column that owns the SCROLL. The
    // panel inside is content-height (no internal scroll), so when the
    // user opens enough accordions to push the panel past the available
    // viewport space, THIS wrapper scrolls and the page/cards stay put.
    // `-mr-2 pr-2` parks the thin scrollbar in the column gutter so it
    // doesn't sit on the panel's cream surface. `scrollbar-gutter: stable`
    // keeps the column width steady whether or not a thumb is showing.
    // z-30 < the sub-navbar's z-40 so the horizontal slide-out tucks
    // behind the sub-navbar background cleanly.
    return (
      <div className='sticky top-[calc(var(--navbar-h)+var(--listings-subnav-h))] z-30 -mr-2 max-h-[calc(100svh-var(--navbar-h)-var(--listings-subnav-h))] overflow-y-auto pr-2 pb-4 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d6c2a8]/70 [&::-webkit-scrollbar-track]:bg-transparent'>
        {panel}
      </div>
    );
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='h-auto rounded-full border-[#c9b39a] bg-white/78 px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#6f5947] shadow-[0_10px_26px_rgba(97,71,42,0.14)] backdrop-blur-sm hover:bg-white'
        >
          <SlidersHorizontal data-icon='inline-start' />
          Filter gowns
        </Button>
      </SheetTrigger>
      <SheetContent
        side='right'
        className='w-full max-w-sm overflow-y-auto border-[#d9c9b6] bg-[#fdf8f1] p-3 shadow-[0_24px_70px_rgba(74,52,30,0.22)] sm:max-w-sm'
      >
        <SheetHeader className='px-1 pb-0'>
          <SheetTitle className='font-display text-xl text-[#3d2f24]'>
            Refine listings
          </SheetTitle>
        </SheetHeader>
        {panel}
      </SheetContent>
    </Sheet>
  );
}
