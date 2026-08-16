import Link from "next/link";
import { notFound } from "next/navigation";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import { AdminFact } from "../../../AdminFact";
import { AdminListPanel } from "../../../AdminListPanel";
import { AdminPageHeader } from "../../../AdminPageHeader";
import { AdminSectionHeading } from "../../../AdminSectionHeading";
import { AdminPendingActionButton } from "../../../AdminPendingActionButton";
import { StatusPill } from "../../../StatusPill";
import {
  FIXTURE_LISTINGS,
  FIXTURE_PAYMENTS,
  getFixtureUser,
} from "../../../admin-fixtures";
import { formatAdminDate, formatCents } from "../../../admin-url";

import type { Metadata } from "next";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: AdminUserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = getFixtureUser(id);
  return {
    title: user?.email ?? "User",
    robots: { index: false, follow: false },
  };
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { id } = await params;
  const user = getFixtureUser(id);
  if (!user) notFound();

  const listings = FIXTURE_LISTINGS.filter((l) => l.user_id === user.id);
  const payments = FIXTURE_PAYMENTS.filter((p) => p.user_id === user.id);

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
        <p className="mt-1 text-sm text-(--muted-ink)">
          Confirm dialogs open; writes are inert until Phase 3.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.is_banned ? (
            <AdminPendingActionButton
              title="Unban user?"
              description="They will be able to sign in again."
              confirmLabel="Unban"
              ariaLabel="Unban user"
              buttonLabel="Unban"
              icon="unban"
            />
          ) : (
            <AdminPendingActionButton
              title="Ban user?"
              description="Blocks sign-in and suspends their active listings."
              confirmLabel="Ban"
              ariaLabel="Ban user"
              buttonLabel="Ban"
              icon="ban"
              confirmVariant="destructive"
            />
          )}
          <AdminPendingActionButton
            title="Force sign-out?"
            description="Ends all sessions for this account. Also revokes an admin claim immediately."
            confirmLabel="Sign out"
            ariaLabel="Force sign-out"
            buttonLabel="Force sign-out"
            icon="signOut"
          />
          <AdminPendingActionButton
            title="Delete account?"
            description="Destructive. Prefer ban when possible. Cascades listings, payments, and wishlist items."
            confirmLabel="Delete"
            ariaLabel="Delete account"
            buttonLabel="Delete"
            icon="delete"
            confirmVariant="destructive"
          />
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
    </div>
  );
}
