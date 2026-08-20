import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  CreditCard,
  Mail,
  Package,
  Shirt,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  ADMIN_QUEUE_PREVIEW_SIZE,
  STALE_ACTIVE_DAYS,
  STUCK_PENDING_PAYMENT_DAYS,
} from "@/lib/admin/constants";
import { listingPriceSummary } from "@/lib/listing-variants";

import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
  ADMIN_STUCK_PAYMENT_SEGMENT,
} from "@/lib/admin/list";
import { getAdminOverview } from "@/lib/queries/admin/overview";

import { AdminDemoToggle } from "../AdminDemoToggle";
import { isAdminDemoMode } from "../admin-demo";
import { demoOverview } from "../admin-fixtures";
import { AdminPageHeader } from "../AdminPageHeader";
import { AdminSectionHeading } from "../AdminSectionHeading";
import { AuditActionPill } from "../AuditActionPill";
import { AuditActorGlyph } from "../AuditActorGlyph";
import { auditActorName } from "../admin-audit-labels";
import { toListingWithSizes } from "@/lib/admin/types";
import { formatAdminDateTime, formatCents } from "../admin-url";
import { StatCluster } from "../StatCluster";
import { ADMIN_STATUS_LABELS } from "../admin-status";
import { StatusPill } from "../StatusPill";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Overview",
  description: "Marketplace inventory and attention queues.",
  robots: { index: false, follow: false },
};

function daysSince(iso: string, asOf: string): number {
  const ms = new Date(asOf).getTime() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default async function AdminOverviewPage() {
  const isDemo = await isAdminDemoMode();
  // Both sources return the same shape, so nothing below this line branches.
  const {
    stats,
    asOf,
    newThisWeek,
    staleActives,
    offMarket,
    stuckPending,
    recentActivity,
  } = isDemo ? demoOverview() : await getAdminOverview();

  const contactAge =
    stats.oldest_contact_message_age_hours == null
      ? "None"
      : stats.oldest_contact_message_age_hours < 24
        ? `${stats.oldest_contact_message_age_hours}h`
        : `${Math.round(stats.oldest_contact_message_age_hours / 24)}d`;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow="Admin"
        title="Overview"
        description="Listings, fees, and queues that need a look."
        action={<AdminDemoToggle isDemo={isDemo} />}
      />

      {/* Every cluster spans an exact fraction of the row at each breakpoint,
          so the grid never ends on a half-empty row. */}
      <section
        aria-label="Stats"
        className="grid grid-cols-2 gap-3 md:grid-cols-12"
      >
        <StatCluster
          label="Listings"
          icon={Shirt}
          tone="inventory"
          className="col-span-2 md:col-span-12 lg:col-span-6"
          items={[
            { label: "Active", value: stats.active_listings },
            { label: "Sold", value: stats.sold_listings },
            { label: "Off market", value: stats.suspended_or_removed },
            { label: "Total gowns", value: stats.total_gowns },
          ]}
        />
        <StatCluster
          label="Fees"
          icon={CreditCard}
          tone="money"
          className="col-span-2 md:col-span-6"
          items={[
            {
              label: "Collected (7d)",
              value: formatCents(stats.fees_collected_this_week_cents),
            },
            { label: "Unpaid", value: stats.pending_payment },
          ]}
        />
        <StatCluster
          label="People"
          icon={Users}
          tone="people"
          className="col-span-1 md:col-span-6 lg:col-span-4"
          items={[
            { label: "Users", value: stats.users_total },
            { label: "New (7d)", value: stats.new_users_this_week },
          ]}
        />
        <StatCluster
          label="This week"
          icon={TrendingUp}
          tone="inventory"
          className="col-span-1 md:col-span-6 lg:col-span-4"
          items={[
            { label: "New listings", value: stats.new_listings_this_week },
            { label: "Sold", value: stats.sold_this_week },
          ]}
        />
        <StatCluster
          label="Inbox"
          icon={Mail}
          tone="attention"
          className="col-span-2 md:col-span-6 lg:col-span-4"
          items={[
            { label: "Total", value: stats.contact_messages_total },
            { label: "Oldest", value: contactAge },
          ]}
        />
      </section>

      {/* `lg:items-start` stops the columns stretching to the taller of the two,
          so every card sizes to its own content at any queue length. At md the
          cards are direct grid children (`md:contents`) and stretch per row. */}
      <section className="grid gap-6 md:grid-cols-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 md:contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
          <QueueCard
            icon={Package}
            title="New this week"
            empty="No new listings this week."
            count={newThisWeek.count}
            href={`/admin/listings?status=${ADMIN_NEW_WEEK_SEGMENT}`}
            viewAllLabel="All new this week"
            className="md:col-span-6"
          >
            {newThisWeek.rows.slice(0, ADMIN_QUEUE_PREVIEW_SIZE).map((l) => (
              <QueueRow
                key={l.id}
                href={`/admin/listings/${l.id}`}
                title={l.title}
                meta={`${l.seller_email} · ${listingPriceSummary(toListingWithSizes(l))}`}
                trailing={<StatusPill status={l.status} />}
              />
            ))}
          </QueueCard>

          {/* Ordered last at md so the three one-line queues pack into a single
              row above it; back in DOM order once the rail exists at lg. */}
          <section
            aria-labelledby="recent-activity-heading"
            className="flex min-w-0 flex-col md:order-last md:col-span-6 lg:order-0"
          >
            <h2
              id="recent-activity-heading"
              className="font-display text-xl text-(--ink)"
            >
              Recent activity
            </h2>
            <div className="surface-panel hairline mt-3 flex flex-col rounded-2xl">
              {recentActivity.length === 0 && (
                <p className="px-4 pt-4 text-sm text-(--muted-ink)">
                  No activity recorded yet.
                </p>
              )}
              <ul className="divide-y divide-(--line)">
                {recentActivity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    {/* The feed mixes actors, and three action slugs are
                        produced by both admins and sellers, so the glyph is
                        what separates them without reading the row. */}
                    <div className="flex min-w-0 gap-2">
                      <AuditActorGlyph role={entry.actor_role} className="mt-0.5" />
                      <div className="min-w-0">
                        <AuditActionPill action={entry.action} />
                        <p className="mt-1.5 truncate text-xs text-(--muted-ink)">
                          {entry.entity_label}
                          {" · "}
                          {auditActorName(entry.actor_email, entry.actor_role)}
                        </p>
                      </div>
                    </div>
                    <time
                      className="shrink-0 text-xs text-(--muted-ink) lg:text-right"
                      dateTime={entry.created_at}
                    >
                      {formatAdminDateTime(entry.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
              <CardFooterLink
                href="/admin/logs"
                label="All activity"
                className="px-4 pb-4"
              />
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6 md:contents lg:flex lg:flex-col lg:gap-6">
          <QueueCard
            icon={Clock}
            title={`Stale actives (>${STALE_ACTIVE_DAYS}d)`}
            empty="Nothing stale."
            count={staleActives.count}
            href={`/admin/listings?status=${ADMIN_STALE_ACTIVE_SEGMENT}`}
            viewAllLabel="All stale actives"
            className="md:col-span-2"
          >
            {staleActives.rows.slice(0, ADMIN_QUEUE_PREVIEW_SIZE).map((l) => (
              <QueueRow
                key={l.id}
                href={`/admin/listings/${l.id}`}
                title={l.title}
                meta={`${daysSince(l.created_at, asOf)} days active`}
              />
            ))}
          </QueueCard>

          <QueueCard
            icon={AlertTriangle}
            title="Off market"
            empty="No moderation events."
            count={offMarket.count}
            href={`/admin/listings?status=${ADMIN_OFF_MARKET_STATUS}`}
            viewAllLabel="All off market"
            className="md:col-span-2"
          >
            {/* Status rides the meta line rather than a trailing pill: this card
                is only ~250px wide at md, and the pill ate enough of the row to
                truncate the gown title down to a few characters. */}
            {offMarket.rows.slice(0, ADMIN_QUEUE_PREVIEW_SIZE).map((l) => (
              <QueueRow
                key={l.id}
                href={`/admin/listings/${l.id}`}
                title={l.title}
                meta={`${ADMIN_STATUS_LABELS[l.status]} · ${l.seller_email}`}
              />
            ))}
          </QueueCard>

          <QueueCard
            icon={CreditCard}
            title={`Stuck payments (≥${STUCK_PENDING_PAYMENT_DAYS}d)`}
            empty="No stuck payments."
            count={stuckPending.count}
            href={`/admin/listings?status=${ADMIN_STUCK_PAYMENT_SEGMENT}`}
            viewAllLabel="All stuck payments"
            className="md:col-span-2"
          >
            {stuckPending.rows.slice(0, ADMIN_QUEUE_PREVIEW_SIZE).map((l) => (
              <QueueRow
                key={l.id}
                href={`/admin/listings/${l.id}`}
                title={l.title}
                meta={`${daysSince(l.created_at, asOf)} days waiting`}
              />
            ))}
          </QueueCard>
        </div>
      </section>
    </div>
  );
}

type QueueCardProps = {
  icon: LucideIcon;
  title: string;
  empty: string;
  count: number;
  /** Destination for the card's footer link. */
  href: string;
  viewAllLabel: string;
  className?: string;
  children: ReactNode;
};

function QueueCard({
  icon: Icon,
  title,
  empty,
  count,
  href,
  viewAllLabel,
  className,
  children,
}: QueueCardProps) {
  return (
    <div
      className={`surface-panel hairline flex min-w-0 flex-col rounded-2xl p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-(--accent-deep)" aria-hidden />
        <AdminSectionHeading>{title}</AdminSectionHeading>
        {/* The queue's true size, so a preview capped at ADMIN_QUEUE_PREVIEW_SIZE
            never reads as the whole queue. */}
        {count > 0 && (
          <span className="ml-auto text-sm tabular-nums text-(--muted-ink)">
            {count}
          </span>
        )}
      </div>
      {count > 0 ? (
        <ul className="flex flex-col gap-1">{children}</ul>
      ) : (
        <p className="text-sm text-(--muted-ink)">{empty}</p>
      )}
      <CardFooterLink href={href} label={viewAllLabel} />
    </div>
  );
}

type CardFooterLinkProps = {
  href: string;
  label: string;
  className?: string;
};

/**
 * Pinned to the bottom of its panel, so when a card stretches to match its
 * neighbour the slack lands above a real control instead of opening a hole.
 */
function CardFooterLink({ href, label, className }: CardFooterLinkProps) {
  return (
    <Link
      href={href}
      className={`mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-xs font-semibold text-(--accent-deep) transition-colors hover:text-(--ink) ${className ?? ""}`}
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

type QueueRowProps = {
  href: string;
  title: string;
  meta: string;
  trailing?: ReactNode;
};

function QueueRow({ href, title, meta, trailing }: QueueRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/60"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--ink)">{title}</p>
          <p className="truncate text-xs text-(--muted-ink)">{meta}</p>
        </div>
        {trailing}
      </Link>
    </li>
  );
}
