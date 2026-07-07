"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";

import FilterCountBadge from "./FilterCountBadge";
import FilterPanel from "./FilterPanel";
import { useBrowseFilters } from "./useBrowseFilters";

type FilterBarProps = {
  variant: "rail" | "drawer";
  minBound: number;
  maxBound: number;
  onCollapseRail?: () => void;
};

export default function FilterBar({
  variant,
  minBound,
  maxBound,
  onCollapseRail,
}: FilterBarProps) {
  const isDrawer = variant === "drawer";
  const fb = useBrowseFilters({ variant, minBound, maxBound });

  const panel = (
    <FilterPanel
      controller={fb}
      minBound={minBound}
      maxBound={maxBound}
      isDrawer={isDrawer}
      onCollapseRail={onCollapseRail}
    />
  );

  if (!isDrawer) {
    // This sticky wrapper owns vertical scroll so expanded filters do not
    // move the listing grid; z-30 keeps the rail below the desktop subnav.
    return (
      <div className="sticky top-[calc(var(--navbar-h)+var(--listings-subnav-h))] z-30 -mr-2 max-h-[calc(100svh-var(--navbar-h)-var(--listings-subnav-h))] overflow-y-auto pr-2 pb-4 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d6c2a8]/70 [&::-webkit-scrollbar-track]:bg-transparent">
        {panel}
      </div>
    );
  }

  return (
    <Sheet open={fb.drawerOpen} onOpenChange={fb.setDrawerOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Filter gowns"
          className="h-auto shrink-0 gap-1.5 rounded-full border-[#c9b39a] bg-white/78 px-3 py-2 text-[#6f5947] backdrop-blur-sm hover:bg-white"
        >
          <SlidersHorizontal />
          <FilterCountBadge count={fb.activeCount} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-sm border-[#d9c9b6] bg-[#fdf8f1] px-3 pt-12 pb-3 shadow-[0_24px_70px_rgba(74,52,30,0.22)] sm:max-w-sm"
      >
        <SheetTitle className="sr-only">Filters</SheetTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
        {fb.activeCount > 0 && (
          <SheetFooter className="px-1 pt-2">
            <SheetClose asChild>
              <Button type="button" className={`${PRIMARY_CTA_CLASS} h-12`}>
                Apply Filters
              </Button>
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
