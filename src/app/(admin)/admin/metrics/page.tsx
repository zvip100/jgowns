import Link from "next/link";
import { CreditCard, ExternalLink, Shirt, TrendingUp } from "lucide-react";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { getAdminMetrics } from "@/lib/queries/admin/metrics";

import { GOWN_CONDITIONS, SELL_MODES } from "@/lib/types";

import {
  ADMIN_SELL_MODE_LABELS,
  adminCategoryShareLabel,
  adminLocationShareLabel,
  adminPriceBandLabel,
} from "../../admin-audit-labels";
import { isAdminDemoMode } from "../../admin-demo";
import { demoMetrics } from "../../admin-fixtures";
import { AdminFact } from "../../AdminFact";
import { AdminPageHeader } from "../../AdminPageHeader";
import { AdminSectionHeading } from "../../AdminSectionHeading";
import { formatResultCount } from "../../AdminResultCount";
import { formatCents } from "../../admin-url";
import { StatCluster } from "../../StatCluster";

import { MetricsCharts } from "./MetricsCharts";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Metrics",
  description: "Marketplace trends and health.",
  robots: { index: false, follow: false },
};

type MixFactProps = {
  label: string;
  rows: { key: string; label: string; count: number }[];
};

/**
 * A short vocabulary rendered as counts inside the health list. Every value is
 * shown even at zero, so the mix reads as a fixed shape rather than a list that
 * grows and shrinks.
 */
function MixFact({ label, rows }: MixFactProps): ReactNode {
  return (
    <AdminFact valueClassName="mt-1.5" label={label}>
      {/* Capped so the count stays visually paired with its label instead of
          drifting to the far edge of a wide column. */}
      <dl className="flex max-w-56 flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="text-(--muted-ink)">{row.label}</dt>
            <dd className="tabular-nums">{row.count}</dd>
          </div>
        ))}
      </dl>
    </AdminFact>
  );
}

export default async function AdminMetricsPage() {
  const isDemo = await isAdminDemoMode();
  const { stats, series, summary } = isDemo
    ? demoMetrics()
    : await getAdminMetrics();

  const totalFees = series.reduce((sum, w) => sum + w.fees_collected_cents, 0);
  // Both fees stats read from the charted series, never the payment rows: that
  // is a different data set and pairing them would imply a relation. The window
  // is labelled from the series length so it can't drift out of date.
  const weeksCharted = series.length;
  const averageWeeklyFees = weeksCharted
    ? Math.round(totalFees / weeksCharted)
    : 0;

  const { attempts, succeeded } = summary.payments;
  const conversionRate = attempts ? Math.round((succeeded / attempts) * 100) : 0;

  // SQL returns stored values; the labels belong to the UI, so both data
  // sources are mapped here rather than in either query path.
  const categories = summary.category_share.map(({ category, count }) => ({
    label: adminCategoryShareLabel(category),
    count,
  }));
  const locations = summary.location_share.map(({ location, count }) => ({
    label: adminLocationShareLabel(location),
    count,
  }));
  const priceBands = summary.price_bands.map(({ band, count }) => ({
    label: adminPriceBandLabel(band),
    count,
  }));

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow="Admin"
        title="Metrics"
        description={
          isDemo
            ? "Previewing fixture data for layout review."
            : "Marketplace aggregates computed from the database."
        }
        action={
          <a
            href="https://us.posthog.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--accent-deep) hover:text-(--ink)"
          >
            Open PostHog
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-12"
      >
        <StatCluster
          label="Listings"
          icon={Shirt}
          tone="inventory"
          className="col-span-1 lg:col-span-4"
          items={[
            { label: "Active", value: stats.active_listings },
            { label: "Total gowns", value: stats.total_gowns },
          ]}
        />
        <StatCluster
          label="This week"
          icon={TrendingUp}
          tone="inventory"
          className="col-span-1 lg:col-span-4"
          items={[
            { label: "Sold", value: stats.sold_this_week },
            { label: "New users", value: stats.new_users_this_week },
          ]}
        />
        <StatCluster
          label="Fees"
          icon={CreditCard}
          tone="money"
          className="col-span-2 lg:col-span-4"
          items={[
            {
              label: `Collected (${formatResultCount(weeksCharted, "week")})`,
              value: formatCents(totalFees),
            },
            { label: "Avg / week", value: formatCents(averageWeeklyFees) },
          ]}
        />
      </section>

      <MetricsCharts
        series={series}
        categories={categories}
        priceBands={priceBands}
        locations={locations}
      />

      <section className="surface-panel hairline rounded-2xl p-5">
        <AdminSectionHeading>Marketplace health</AdminSectionHeading>
        {/* Six facts in two clean rows of three. Condition and sell mode are
            three-value vocabularies, and §6.5 rules out a chart for something a
            number answers, so they live here as counts rather than as panels. */}
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <AdminFact valueClassName="mt-1" label="Most wishlisted">
            {summary.most_wishlisted ? (
              <Link
                href={`/admin/listings/${summary.most_wishlisted.id}`}
                className="text-(--accent-deep) hover:underline"
              >
                {summary.most_wishlisted.title}
              </Link>
            ) : (
              "No saves yet"
            )}
            <span className="block text-xs text-(--muted-ink)">
              {summary.most_wishlisted?.saves ?? 0} saves
            </span>
          </AdminFact>
          <AdminFact valueClassName="mt-1" label="Median time to sold">
            {summary.median_time_to_sold_days == null
              ? ADMIN_EMPTY_VALUE
              : `${summary.median_time_to_sold_days}d`}
            <span className="block text-xs text-(--muted-ink)">
              Listing created to sold.
            </span>
          </AdminFact>
          <AdminFact valueClassName="mt-1" label="Payment conversion">
            {conversionRate}%
            <span className="block text-xs text-(--muted-ink)">
              {succeeded} of {attempts} checkout attempts paid
            </span>
          </AdminFact>
          <AdminFact valueClassName="mt-1" label="Actives with no available size">
            {summary.actives_with_no_available_size}
            <span className="block text-xs text-(--muted-ink)">
              Invariant check. Should always be zero.
            </span>
          </AdminFact>
          <MixFact
            label="Condition mix"
            // Quality tier order, not alphabetical and not by count, so the
            // rows stay put as inventory moves (MEMORY 07-27).
            rows={GOWN_CONDITIONS.map((condition) => ({
              key: condition,
              label: condition,
              count: summary.condition_mix[condition] ?? 0,
            }))}
          />
          <MixFact
            label="Sell mode mix"
            rows={SELL_MODES.map((mode) => ({
              key: mode,
              label: ADMIN_SELL_MODE_LABELS[mode],
              count: summary.sell_mode_mix[mode] ?? 0,
            }))}
          />
        </dl>
      </section>
    </div>
  );
}
