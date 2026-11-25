import { CloudOff, Eye, Timer, TrendingUp, Users } from "lucide-react";

import { formatDayLabel } from "@/lib/admin/list";
import {
  ADMIN_CHART_PANEL_CLASS,
  ADMIN_STAT_GRID_CLASS,
  STAT_CLUSTER_SURFACE_CLASS,
  TRAFFIC_BLOCK_SPAN,
  TRAFFIC_CHART_ASPECT_CLASS,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { StatCluster, statClusterCellsClass } from "../../StatCluster";

import { TrafficChart } from "./TrafficChart";
import {
  formatAsOf,
  formatCount,
  formatDuration,
  formatPercent,
  oldestRefresh,
  rateHint,
  weekOverWeekHint,
} from "./traffic-format";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { StatClusterTone } from "../../StatCluster";
import type {
  TrafficDay,
  TrafficEngagement,
  TrafficResult,
  TrafficWeekCounts,
  TrafficWeekly,
} from "@/lib/admin/types";

type CountItem = { label: string; key: keyof TrafficWeekCounts };

type CountBlockConfig = {
  label: string;
  icon: LucideIcon;
  tone: StatClusterTone;
  items: CountItem[];
  className: string;
};

/** The three blocks that read the weekly endpoint, in page order. */
export const TRAFFIC_COUNT_BLOCKS = {
  headline: {
    label: "This week",
    icon: Users,
    tone: "people",
    className: TRAFFIC_BLOCK_SPAN.full,
    items: [
      { label: "Visitors", key: "visitors" },
      { label: "Pageviews", key: "pageviews" },
      { label: "Sessions", key: "sessions" },
      { label: "Paid listings", key: "paid_listings" },
    ],
  },
  funnel: {
    label: "Seller funnel",
    icon: TrendingUp,
    tone: "inventory",
    className: TRAFFIC_BLOCK_SPAN.full,
    items: [
      { label: "Sell clicks", key: "sell_clicks" },
      { label: "Registrations", key: "registrations" },
      { label: "Drafts started", key: "drafts_started" },
      { label: "Listings submitted", key: "listings_submitted" },
      { label: "Checkouts started", key: "checkouts_started" },
      { label: "Paid", key: "paid_listings" },
    ],
  },
  intent: {
    label: "Buyer intent",
    icon: Eye,
    tone: "inventory",
    className: TRAFFIC_BLOCK_SPAN.intent,
    items: [
      { label: "Listing views", key: "listing_views" },
      { label: "Contact actions", key: "contact_actions" },
      { label: "Wishlist adds", key: "wishlist_adds" },
    ],
  },
} satisfies Record<string, CountBlockConfig>;

type TrafficUnavailableProps = {
  label: string;
  className?: string;
};

/** One block's PostHog read failed; the rest of the page still renders. */
export function TrafficUnavailable({ label, className }: TrafficUnavailableProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "stat-surface flex items-center gap-3 rounded-2xl px-4 py-5",
        className,
      )}
    >
      <CloudOff
        className="size-5 shrink-0 text-(--muted-ink)"
        strokeWidth={1.75}
        aria-hidden
      />
      <div>
        <p className="text-[0.6rem] font-semibold tracking-[0.18em] text-(--muted-ink) uppercase">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-(--ink)">
          Traffic data is unavailable.
        </p>
        <p className="text-xs text-(--muted-ink)">Try again in a few minutes.</p>
      </div>
    </section>
  );
}

type CountBlockProps = CountBlockConfig & {
  weekly: Promise<TrafficResult<TrafficWeekly>>;
};

/** A StatCluster of weekly counts, each with its week-over-week hint. */
export async function TrafficCountBlock({
  weekly,
  label,
  icon,
  tone,
  items,
  className,
}: CountBlockProps): Promise<ReactNode> {
  const result = await weekly;
  if (result.status !== "ok") {
    return <TrafficUnavailable label={label} className={className} />;
  }

  const { thisWeek, lastWeek } = result.data;
  return (
    <StatCluster
      label={label}
      icon={icon}
      tone={tone}
      className={className}
      items={items.map(({ label: itemLabel, key }) => ({
        label: itemLabel,
        value: formatCount(thisWeek[key]),
        hint: weekOverWeekHint(thisWeek[key], lastWeek[key]),
      }))}
    />
  );
}

type EngagementBlockProps = {
  engagement: Promise<TrafficResult<TrafficEngagement>>;
};

export async function TrafficEngagementBlock({
  engagement,
}: EngagementBlockProps): Promise<ReactNode> {
  const result = await engagement;
  if (result.status !== "ok") {
    return (
      <TrafficUnavailable label="Engagement" className={TRAFFIC_BLOCK_SPAN.engagement} />
    );
  }

  const { thisWeek, lastWeek } = result.data;
  return (
    <StatCluster
      label="Engagement"
      icon={Timer}
      tone="people"
      className={TRAFFIC_BLOCK_SPAN.engagement}
      items={[
        {
          label: "Bounce rate",
          value: formatPercent(thisWeek.bounce_rate),
          hint: rateHint(thisWeek.bounce_rate, lastWeek.bounce_rate),
        },
        {
          label: "Avg session",
          value: formatDuration(thisWeek.avg_session_seconds),
          hint: weekOverWeekHint(
            thisWeek.avg_session_seconds,
            lastWeek.avg_session_seconds,
            formatDuration,
          ),
        },
      ]}
    />
  );
}

type ChartBlockProps = {
  daily: Promise<TrafficResult<TrafficDay[]>>;
};

export async function TrafficChartBlock({ daily }: ChartBlockProps): Promise<ReactNode> {
  const result = await daily;
  if (result.status !== "ok") {
    return <TrafficUnavailable label="Visitors & pageviews" />;
  }

  return (
    <TrafficChart
      points={result.data.map((day) => ({
        label: formatDayLabel(day.day),
        visitors: day.visitors,
        pageviews: day.pageviews,
        isPartial: day.isPartial,
      }))}
    />
  );
}

type AsOfProps = {
  results: Promise<TrafficResult<unknown>[]>;
};

/** The one snapshot time the page claims: the oldest PostHog refresh that loaded. */
export async function TrafficAsOf({ results }: AsOfProps): Promise<ReactNode> {
  const refreshedAt = oldestRefresh(await results);
  if (!refreshedAt) return null;
  return <strong className="font-semibold text-(--ink)">{formatAsOf(refreshedAt)}.</strong>;
}

const SKELETON = "animate-pulse rounded bg-[#eadfce]";

type ClusterSkeletonProps = {
  cells: number;
  className?: string;
};

/** Shaped like a StatCluster, using its own cell grid so loading never reflows. */
export function TrafficClusterSkeleton({ cells, className }: ClusterSkeletonProps) {
  return (
    <div aria-hidden className={cn(STAT_CLUSTER_SURFACE_CLASS, className)}>
      <div className="border-b border-(--line) bg-white/55 px-4 py-3">
        <div className={cn(SKELETON, "h-2.5 w-24")} />
      </div>
      <div className={statClusterCellsClass(cells)}>
        {Array.from({ length: cells }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className={cn(SKELETON, "h-2 w-16")} />
            <div className={cn(SKELETON, "h-6 w-12")} />
            <div className={cn(SKELETON, "h-2 w-20")} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrafficAsOfSkeleton() {
  return <span aria-hidden className={cn(SKELETON, "inline-block h-3 w-40 align-middle")} />;
}

export function TrafficChartSkeleton() {
  return (
    <div aria-hidden className={ADMIN_CHART_PANEL_CLASS}>
      <div className={cn(SKELETON, "h-4 w-40")} />
      <div className={cn(SKELETON, "mt-2 h-3 w-24")} />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className={cn(SKELETON, TRAFFIC_CHART_ASPECT_CLASS)} />
        ))}
      </div>
    </div>
  );
}

type TrafficCountSkeletonProps = {
  block: CountBlockConfig;
};

/** The fallback for one TRAFFIC_COUNT_BLOCKS entry. */
export function TrafficCountSkeleton({ block }: TrafficCountSkeletonProps) {
  return <TrafficClusterSkeleton cells={block.items.length} className={block.className} />;
}

export function TrafficEngagementSkeleton() {
  return (
    <TrafficClusterSkeleton cells={2} className={TRAFFIC_BLOCK_SPAN.engagement} />
  );
}

/** The whole report's shape, shown until the request-time half starts streaming. */
export function TrafficReportSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className={ADMIN_STAT_GRID_CLASS}>
        <TrafficCountSkeleton block={TRAFFIC_COUNT_BLOCKS.headline} />
      </div>
      <TrafficChartSkeleton />
      <div className={ADMIN_STAT_GRID_CLASS}>
        <TrafficCountSkeleton block={TRAFFIC_COUNT_BLOCKS.funnel} />
        <TrafficCountSkeleton block={TRAFFIC_COUNT_BLOCKS.intent} />
        <TrafficEngagementSkeleton />
      </div>
    </div>
  );
}
