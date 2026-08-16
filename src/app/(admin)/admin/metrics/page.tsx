import Link from "next/link";
import { CreditCard, ExternalLink, Shirt, TrendingUp } from "lucide-react";

import {
  FIXTURE_CATEGORY_SHARE,
  FIXTURE_LISTINGS,
  FIXTURE_METRICS_SERIES,
  FIXTURE_OVERVIEW_STATS,
  FIXTURE_PAYMENTS,
} from "../../admin-fixtures";
import { AdminFact } from "../../AdminFact";
import { AdminPageHeader } from "../../AdminPageHeader";
import { AdminSectionHeading } from "../../AdminSectionHeading";
import { formatResultCount } from "../../AdminResultCount";
import { formatCents } from "../../admin-url";
import { StatCluster } from "../../StatCluster";

import { MetricsCharts } from "./MetricsCharts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Metrics",
  description: "Marketplace trends and health.",
  robots: { index: false, follow: false },
};

export default function AdminMetricsPage() {
  const stats = FIXTURE_OVERVIEW_STATS;
  const totalFees = FIXTURE_METRICS_SERIES.reduce(
    (sum, w) => sum + w.fees_collected_cents,
    0,
  );
  // Both fees stats read from the charted series, never the payments fixture:
  // that is a different data set and pairing them would imply a relation. The
  // window is labelled from the series length so it can't drift out of date.
  const weeksCharted = FIXTURE_METRICS_SERIES.length;
  const averageWeeklyFees = weeksCharted
    ? Math.round(totalFees / weeksCharted)
    : 0;

  const mostWishlisted = [...FIXTURE_LISTINGS].sort(
    (a, b) => b.saved_count - a.saved_count,
  )[0];

  const succeededPayments = FIXTURE_PAYMENTS.filter(
    (p) => p.status === "succeeded",
  ).length;
  const conversionRate = FIXTURE_PAYMENTS.length
    ? Math.round((succeededPayments / FIXTURE_PAYMENTS.length) * 100)
    : 0;

  const emptyActives = FIXTURE_LISTINGS.filter(
    (l) =>
      l.status === "active" &&
      l.sizes.every((size) => size.status === "sold"),
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow="Admin"
        title="Metrics"
        description="Marketplace aggregates. Traffic analytics land with PostHog in Phase 2."
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
        series={FIXTURE_METRICS_SERIES}
        categories={FIXTURE_CATEGORY_SHARE}
      />

      <section className="surface-panel hairline rounded-2xl p-5">
        <AdminSectionHeading>Marketplace health</AdminSectionHeading>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <AdminFact valueClassName="mt-1" label="Most wishlisted">
            {mostWishlisted ? (
              <Link
                href={`/admin/listings/${mostWishlisted.id}`}
                className="text-(--accent-deep) hover:underline"
              >
                {mostWishlisted.title}
              </Link>
            ) : (
              "No saves yet"
            )}
            <span className="block text-xs text-(--muted-ink)">
              {mostWishlisted?.saved_count ?? 0} saves
            </span>
          </AdminFact>
          <AdminFact valueClassName="mt-1" label="Payment conversion">
            {conversionRate}%
            <span className="block text-xs text-(--muted-ink)">
              {succeededPayments} of {FIXTURE_PAYMENTS.length} checkout attempts
              paid
            </span>
          </AdminFact>
          <AdminFact valueClassName="mt-1" label="Actives with no available size">
            {emptyActives}
            <span className="block text-xs text-(--muted-ink)">
              Invariant check. Should always be zero.
            </span>
          </AdminFact>
        </dl>
      </section>
    </div>
  );
}
