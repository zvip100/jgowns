import { Check } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  FILTER_COUNT_BADGE_CLASS,
  FILTER_PILL_CHECK_CLASS,
  FILTER_PILL_CLASS,
} from "@/lib/styles";

import type { ReactNode } from "react";
import type { SizeOption } from "@/lib/gown-sizes";

type Option = { value: string; label: string };

const triggerClass =
  "group/accordion-trigger relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3.5 text-left text-sm font-medium text-[#5a4738] outline-none transition-colors hover:bg-white/55 hover:no-underline focus-visible:bg-white/60 focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[state=open]:bg-white/55";

const itemClass =
  "rounded-xl border-0 not-last:border-b not-last:border-[#e6d8c3]/70";

const labelClass =
  "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#6f5947]";

const activeBadgeClass = `${FILTER_COUNT_BADGE_CLASS} px-2.5 py-0.5 text-[0.7rem] uppercase tracking-[0.1em]`;

const idleBadgeClass =
  "rounded-full border border-[#dccbb5] bg-white/55 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.13em] text-[#a08770]";

const triggerRowClass =
  "flex flex-1 items-center justify-between gap-3 pr-2 min-w-0";

const pillRowClass = "flex flex-wrap gap-1.5";

type CountBadgeProps = {
  count: number;
};

function CountBadge({ count }: CountBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={count > 0 ? activeBadgeClass : idleBadgeClass}
    >
      {count > 0 ? count : "All"}
    </Badge>
  );
}

type FilterPillProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function FilterPill({ active, onClick, children }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      aria-pressed={active}
      className={FILTER_PILL_CLASS}
    >
      <Check className={FILTER_PILL_CHECK_CLASS} strokeWidth={3} aria-hidden="true" />
      <span className="grid">
        <span className="col-start-1 row-start-1">{children}</span>
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 font-semibold"
        >
          {children}
        </span>
      </span>
    </button>
  );
}

type FilterSectionProps = {
  value: string;
  label: string;
  count: number;
  contentClassName?: string;
  children: ReactNode;
};

export function FilterSection({
  value,
  label,
  count,
  contentClassName = "px-1 pb-3",
  children,
}: FilterSectionProps) {
  return (
    <AccordionItem value={value} className={itemClass}>
      <AccordionTrigger className={triggerClass}>
        <span className={triggerRowClass}>
          <span className={labelClass}>{label}</span>
          <CountBadge count={count} />
        </span>
      </AccordionTrigger>
      <AccordionContent className={contentClassName}>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

type MultiPillGroupProps = {
  options: ReadonlyArray<Option>;
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  ariaLabel: string;
};

export function MultiPillGroup({
  options,
  selected,
  onToggle,
  onClear,
  ariaLabel,
}: MultiPillGroupProps) {
  const hasAny = selected.length > 0;
  return (
    <div role="group" aria-label={ariaLabel} className={pillRowClass}>
      <FilterPill active={!hasAny} onClick={onClear}>
        All
      </FilterPill>
      {options.map((opt) => (
        <FilterPill
          key={opt.value}
          active={selected.includes(opt.value)}
          onClick={() => onToggle(opt.value)}
        >
          {opt.label}
        </FilterPill>
      ))}
    </div>
  );
}

type GroupedSizePillsProps = {
  options: ReadonlyArray<SizeOption>;
  selected: string[];
  onToggle: (token: string) => void;
  onClear: () => void;
  ariaLabel: string;
};

export function GroupedSizePills({
  options,
  selected,
  onToggle,
  onClear,
  ariaLabel,
}: GroupedSizePillsProps) {
  const hasAny = selected.length > 0;
  const hasGroups = options.some((o) => o.group);

  const renderButtons = (opts: ReadonlyArray<SizeOption>) =>
    opts.map((opt) => (
      <FilterPill
        key={opt.filterToken}
        active={selected.includes(opt.filterToken)}
        onClick={() => onToggle(opt.filterToken)}
      >
        {opt.label}
      </FilterPill>
    ));

  if (!hasGroups) {
    return (
      <div role="group" aria-label={ariaLabel} className={pillRowClass}>
        <FilterPill active={!hasAny} onClick={onClear}>
          All
        </FilterPill>
        {renderButtons(options)}
      </div>
    );
  }

  const sections = new Map<string, SizeOption[]>();
  for (const opt of options) {
    const g = opt.group ?? "Other";
    if (!sections.has(g)) sections.set(g, []);
    sections.get(g)!.push(opt);
  }

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={ariaLabel}>
      <div className={pillRowClass}>
        <FilterPill active={!hasAny} onClick={onClear}>
          All
        </FilterPill>
      </div>
      {[...sections.entries()].map(([group, opts]) => (
        <div key={group}>
          <p className="mb-1.5 px-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]">
            {group}
          </p>
          <div className={pillRowClass}>{renderButtons(opts)}</div>
        </div>
      ))}
    </div>
  );
}

type SinglePillGroupProps = {
  options: ReadonlyArray<Option>;
  value: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
};

export function SinglePillGroup({
  options,
  value,
  onSelect,
  ariaLabel,
}: SinglePillGroupProps) {
  return (
    <div role="group" aria-label={ariaLabel} className={pillRowClass}>
      <FilterPill active={!value} onClick={() => onSelect("")}>
        All
      </FilterPill>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <FilterPill
            key={opt.value}
            active={active}
            onClick={() => onSelect(active ? "" : opt.value)}
          >
            {opt.label}
          </FilterPill>
        );
      })}
    </div>
  );
}
