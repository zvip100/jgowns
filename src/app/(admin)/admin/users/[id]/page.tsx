import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { isAdminDemoMode } from "@/lib/admin/demo";
import { getAdminListingsForUser } from "@/lib/queries/admin/listings";
import { getAuditLogForActor } from "@/lib/queries/admin/logs";
import { getAdminPaymentsFor } from "@/lib/queries/admin/payments";
import { getAdminUser } from "@/lib/queries/admin/users";

import { AdminFact } from "../../../AdminFact";
import { AdminListPanel } from "../../../AdminListPanel";
import { AdminPageHeader } from "../../../AdminPageHeader";
import { AdminSectionHeading } from "../../../AdminSectionHeading";
import { AuditActionPill } from "../../../AuditActionPill";
import { AuditActorGlyph } from "../../../AuditActorGlyph";
import { StatusPill } from "../../../StatusPill";
import {
  AdminBanUserButton,
  AdminDeleteUserButton,
  AdminUnbanUserButton,
} from "../../../admin-action-buttons";
import {
  FIXTURE_LISTINGS,
  FIXTURE_PAYMENTS,
  demoAuditLogForActor,
  getFixtureUser,
} from "../../../admin-fixtures";
import { formatAdminDate, formatAdminDateTime, formatCents } from "../../../admin-url";

import type { Metadata } from "next";
import type {
  AdminListing,
  AdminPaymentRow,
  AdminUser,
} from "@/lib/admin/types";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

/** Deduped so generateMetadata and the page body share one read. */
const loadUser = cache(async (id: string): Promise<AdminUser | null> => {
  if (await isAdminDemoMode()) return getFixtureUser(id) ?? null;
  return getAdminUser(id);
});

export async function generateMetadata({
  params,
}: AdminUserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await loadUser(id);
  return {
    title: user?.email ?? "User",
    robots: { index: false, follow: false },
  };
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { id } = await params;
  const isDemo = await isAdminDemoMode();
  const user = await loadUser(id);
  if (!user) notFound();

  // Demo mode branches for activity too: calling the real reader here would
  // put genuine audit rows under a fixture user, which is exactly the mixing
  // the toggle exists to prevent.
  const [listings, payments, activity] = isDemo
    ? [
        FIXTURE_LISTINGS.filter(
          (listing: AdminListing): boolean => listing.user_id === user.id,
        ),
        FIXTURE_PAYMENTS.filter(
          (payment: AdminPaymentRow): boolean => payment.user_id === user.id,
        ),
        demoAuditLogForActor(user.id),
      ]
    : await Promise.all([
        getAdminListingsForUser(user.id),
        getAdminPaymentsFor({ userId: user.id }),
        getAuditLogForActor(user.id),
      ]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader variant="detail" eyebrow="User" title={user.email}>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-(--muted-ink)">
          <span className="capitalize">{user.provider}</span>
          {user.is_admin && (
            <span className="font-semibold text-(--accent-deep)">Admin</span>
          )}
          {user.is_banned && (
            <span className="font-semibold text-[#8a3a3a]">Banned</span>
          )}
        </div>
      </AdminPageHeader>

      <section className="surface-panel hairline rounded-2xl p-5">
        <AdminSectionHeading>Profile</AdminSectionHeading>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <AdminFact label="Phone">{user.phone ?? ADMIN_EMPTY_VALUE}</AdminFact>
          <AdminFact label="Joined">{formatAdminDate(user.created_at)}</AdminFact>
          <AdminFact label="Last sign-in">
            {user.last_sign_in_at
              ? formatAdminDate(user.last_sign_in_at)
              : ADMIN_EMPTY_VALUE}
          </AdminFact>
          <AdminFact label="Role">{user.is_admin ? "Admin" : "Seller"}</AdminFact>
        </dl>
      </section>

      <section>
        <AdminSectionHeading>Actions</AdminSectionHeading>
        {/* No force sign-out: the Auth Admin API revokes a session by JWT, not
            by user id, and an admin never holds another person's token. Ban is
            the substitute, and an open session lasts until its token expires. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {user.is_banned ? (
            <AdminUnbanUserButton userId={user.id} isDemo={isDemo} />
          ) : (
            <AdminBanUserButton userId={user.id} isDemo={isDemo} />
          )}
          <AdminDeleteUserButton userId={user.id} isDemo={isDemo} />
        </div>
      </section>

      <section>
        <AdminSectionHeading>Listings</AdminSectionHeading>
        <AdminListPanel isEmpty={listings.length === 0} emptyLabel="No listings.">
          {listings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/listings/${l.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/50"
              >
                <span className="truncate text-sm font-medium text-(--ink)">
                  {l.title}
                </span>
                <StatusPill status={l.status} />
              </Link>
            </li>
          ))}
        </AdminListPanel>
      </section>

      <section>
        <AdminSectionHeading>Payments</AdminSectionHeading>
        <AdminListPanel
          isEmpty={payments.length === 0}
          emptyLabel="No payment rows."
        >
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/listings/${p.listing_id}`}
                  className="font-medium text-(--ink) hover:text-(--accent-deep)"
                >
                  {p.listing_title}
                </Link>
                <p className="text-xs text-(--muted-ink)">{p.status}</p>
              </div>
              <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
            </li>
          ))}
        </AdminListPanel>
      </section>

      <section>
        <AdminSectionHeading>Activity</AdminSectionHeading>
        <AdminListPanel
          isEmpty={activity.length === 0}
          emptyLabel="No recorded activity."
        >
          {activity.map((entry) => (
            <li key={entry.id} className="flex gap-2 px-4 py-3 text-sm">
              <AuditActorGlyph role={entry.actor_role} className="mt-0.5" />
              <div className="min-w-0">
                <AuditActionPill action={entry.action} />
                {/* Every row here is this person's, so the actor name would be
                    the page title repeated; the glyph still carries the role. */}
                <p className="mt-1 truncate text-xs text-(--muted-ink)">
                  {entry.entity_label}
                </p>
                <time
                  className="mt-1 block text-xs text-(--muted-ink)"
                  dateTime={entry.created_at}
                >
                  {formatAdminDateTime(entry.created_at)}
                </time>
              </div>
            </li>
          ))}
        </AdminListPanel>
        <Link
          href={`/admin/logs?q=${encodeURIComponent(user.email)}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-(--accent-deep) hover:text-(--ink)"
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
