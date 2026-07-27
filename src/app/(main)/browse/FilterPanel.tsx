import { ChevronLeft, X } from "lucide-react";

import { BROWSE_COND_VALUES } from "@/lib/browse-filters";
import { parseBrowseParamList } from "@/lib/browse-params";
import { GOWN_COLORS, LOCATIONS } from "@/lib/types";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import {
  FilterSection,
  GroupedSizePills,
  MultiPillGroup,
  SinglePillGroup,
} from "./filter-controls";

import type { BrowseFiltersController } from "./useBrowseFilters";

const COLOR_OPTIONS = GOWN_COLORS.map((c) => ({ value: c, label: c }));
const LOCATION_OPTIONS = LOCATIONS.map((l) => ({ value: l, label: l }));

// `cond=no-alterations` preserves the combined "Ready to Wear" URL value.
const CONDITION_OPTIONS = [
  { value: "no-alterations", label: "Ready to Wear" },
  { value: "Brand New", label: "Brand New Only" },
] satisfies ReadonlyArray<{
  value: (typeof BROWSE_COND_VALUES)[number];
  label: string;
}>;

type FilterPanelProps = {
  controller: BrowseFiltersController;
  minBound: number;
  maxBound: number;
  isDrawer: boolean;
  onCollapseRail?: () => void;
};

export default function FilterPanel({
  controller,
  minBound,
  maxBound,
  isDrawer,
  onCollapseRail,
}: FilterPanelProps) {
  const sizeSelected = parseBrowseParamList(controller.local.size || null);
  const colorSelected = parseBrowseParamList(controller.local.color || null);
  const locationSelected = parseBrowseParamList(
    controller.local.location || null,
  );

  return (
    <div
      className={cn(
        "surface-panel hairline px-4 py-4 sm:px-5",
        isDrawer
          ? "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.74)]! rounded-[1.75rem]"
          : "rail-open-top rounded-b-[1.75rem]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <p className="font-display text-lg text-[#47362a] sm:text-xl">Filters</p>
        <div className="flex items-center gap-2">
          {controller.hasFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={controller.clearAll}
              className="rounded-full border-[#d4c2ad] bg-white/60 text-[0.63rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:border-[#c9a880] hover:bg-white hover:text-[#5a4537]"
            >
              <X data-icon="inline-start" />
              Clear
            </Button>
          )}
          {onCollapseRail && !isDrawer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCollapseRail}
              className="rounded-full border-[#d4c2ad] bg-white/70 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#7a6350] hover:bg-white"
            >
              <ChevronLeft data-icon="inline-start" />
              Hide
            </Button>
          )}
        </div>
      </div>
      <div className="soft-divider mb-2" />

      <Accordion
        type="multiple"
        value={controller.openAccordions}
        onValueChange={controller.setOpenAccordions}
        className="flex w-full flex-col gap-1.5"
      >
        <FilterSection
          value="size"
          label="Size"
          count={controller.multiFilterCount("size")}
          contentClassName="px-1 pb-3 h-auto"
        >
          <GroupedSizePills
            options={controller.sizeFilterOptions}
            selected={sizeSelected}
            onToggle={(token) => controller.toggleMulti("size", token)}
            onClear={() => controller.updateFilter("size", "")}
            ariaLabel="Size"
          />
        </FilterSection>

        <FilterSection
          value="color"
          label="Color"
          count={controller.multiFilterCount("color")}
        >
          <MultiPillGroup
            options={COLOR_OPTIONS}
            selected={colorSelected}
            onToggle={(value) => controller.toggleMulti("color", value)}
            onClear={() => controller.updateFilter("color", "")}
            ariaLabel="Color"
          />
        </FilterSection>

        <FilterSection
          value="location"
          label="Location"
          count={controller.multiFilterCount("location")}
        >
          <MultiPillGroup
            options={LOCATION_OPTIONS}
            selected={locationSelected}
            onToggle={(value) => controller.toggleMulti("location", value)}
            onClear={() => controller.updateFilter("location", "")}
            ariaLabel="Location"
          />
        </FilterSection>

        <FilterSection
          value="condition"
          label="Condition"
          count={controller.local.cond ? 1 : 0}
        >
          <SinglePillGroup
            options={CONDITION_OPTIONS}
            value={controller.local.cond}
            onSelect={(value) => controller.updateFilter("cond", value)}
            ariaLabel="Condition"
          />
        </FilterSection>

        <FilterSection
          value="price"
          label="Price"
          count={controller.priceActive ? 1 : 0}
          contentClassName="px-1 pt-1 pb-3"
        >
          <div className="rounded-2xl border border-[#d9c9b6] bg-white/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462]">
              Range
            </p>
            <p className="mt-1 text-sm font-semibold text-[#6a5442]">
              ${controller.currentMin.toLocaleString()} – $
              {controller.currentMax.toLocaleString()}
            </p>
            <div className="mt-3">
              <Slider
                min={minBound}
                max={maxBound}
                step={50}
                value={[controller.currentMin, controller.currentMax]}
                onValueChange={([lo, hi]) => controller.syncPrices(lo, hi)}
                aria-label="Price range"
              />
            </div>
          </div>
        </FilterSection>
      </Accordion>
    </div>
  );
}
