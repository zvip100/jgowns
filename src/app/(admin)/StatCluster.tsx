import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

export type StatClusterTone = "inventory" | "money" | "people" | "attention";

export type StatClusterItem = {
  label: string;
  value: string | number;
  hint?: string;
};

type StatClusterProps = {
  label: string;
  icon: LucideIcon;
  tone: StatClusterTone;
  items: StatClusterItem[];
  /** Column span for the page's stat grid. */
  className?: string;
};

const TONE_CLASS: Record<StatClusterTone, string> = {
  inventory: "text-(--accent-deep)",
  money: "text-[#2d7a4f]",
  people: "text-(--muted-ink)",
  attention: "text-(--sold)",
};

/**
 * A named group of related numbers. Category comes from the header glyph and
 * the group itself, so the accent stays rare instead of repeating on every
 * number. Cells lay themselves out from the cluster's own width (`@container`)
 * rather than the viewport, so a half-width cluster stacks while a full-width
 * one spreads, whatever span the page gives it.
 */
export function StatCluster({
  label,
  icon: Icon,
  tone,
  items,
  className,
}: StatClusterProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "stat-surface @container flex flex-col overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-(--line) bg-white/55 px-4 py-2.5",
          TONE_CLASS[tone],
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <h3 className="text-[0.6rem] font-semibold tracking-[0.18em] uppercase">
          {label}
        </h3>
      </div>

      <dl
        className={cn(
          "grid flex-1 grid-cols-1 gap-x-6 gap-y-4 px-4 py-3.5",
          // The two-column step only runs for even counts: three cells in two
          // columns would strand an empty half, which is the thing this layout
          // exists to avoid.
          items.length % 2 === 0 && "@min-[15rem]:grid-cols-2",
          items.length > 1 &&
            "@min-[24rem]:auto-cols-fr @min-[24rem]:grid-flow-col @min-[24rem]:grid-cols-none",
        )}
      >
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[0.62rem] font-semibold tracking-[0.18em] text-(--muted-ink) uppercase">
              {item.label}
            </dt>
            <dd className="mt-1.5 font-display text-2xl font-medium text-(--ink) tabular-nums sm:text-[1.75rem]">
              {item.value}
            </dd>
            {item.hint && (
              <dd className="mt-1 text-xs text-(--muted-ink)">{item.hint}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
