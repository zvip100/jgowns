import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import {
  listingPriceSummary,
  sortListingSizes,
} from "@/lib/listing-variants";
import { FormInfoBanner } from "@/components/form/FormInfoBanner";
import { TableCell, TableRow } from "@/components/ui/table";

import { AdminFact } from "../../../AdminFact";
import { AdminListPanel } from "../../../AdminListPanel";
import { AdminPageHeader } from "../../../AdminPageHeader";
import { AdminSectionHeading } from "../../../AdminSectionHeading";
import { AdminPendingActionButton } from "../../../AdminPendingActionButton";
import { AdminTable } from "../../../AdminTable";
import { AdminThumbnail } from "../../../AdminThumbnail";
import { adminCategoryLabel } from "../../../admin-audit-labels";
import {
  FIXTURE_AUDIT_LOG,
  FIXTURE_PAYMENTS,
  getFixtureListing,
} from "../../../admin-fixtures";
import { toListingWithSizes } from "../../../admin-types";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatCents,
  stripeSessionUrl,
} from "../../../admin-url";
import { StatusPill } from "../../../StatusPill";

import type { Metadata } from "next";

type AdminListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: AdminListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = getFixtureListing(id);
  return {
    title: listing?.title ?? "Listing",
    robots: { index: false, follow: false },
  };
}

export default async function AdminListingDetailPage({
  params,
}: AdminListingDetailPageProps) {
  const { id } = await params;
  const listing = getFixtureListing(id);
  if (!listing) notFound();

  const category = adminCategoryLabel(listing.category);
  const payments = FIXTURE_PAYMENTS.filter((p) => p.listing_id === listing.id);
  const timeline = FIXTURE_AUDIT_LOG.filter(
    (e) => e.entity_type === "listing" && e.entity_id === listing.id,
  );
  const sizes = sortListingSizes(listing.sizes);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        variant="detail"
        eyebrow="Listing"
        title={listing.title}
        action={
          <Link
            href={`/admin/listings/${listing.id}/edit`}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#b58d5f]/70 gold-gradient px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]"
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit listing
          </Link>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={listing.status} />
          <span className="text-sm text-(--muted-ink)">
            {listingPriceSummary(toListingWithSizes(listing))}
          </span>
        </div>
      </AdminPageHeader>

      {listing.status === "suspended" && listing.suspension_reason && (
        <FormInfoBanner icon={Ban}>
          <strong>Suspended by moderation.</strong>{" "}
          {listing.suspension_reason}
        </FormInfoBanner>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="surface-panel hairline rounded-2xl p-5">
          <AdminSectionHeading>Details</AdminSectionHeading>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <AdminFact label="Seller">
              <Link
                href={`/admin/users/${listing.user_id}`}
                className="text-(--accent-deep) hover:underline"
              >
                {listing.seller_email}
              </Link>
            </AdminFact>
            <AdminFact label="Category">{category}</AdminFact>
            <AdminFact label="Location">
              {listing.location ?? ADMIN_EMPTY_VALUE}
            </AdminFact>
            <AdminFact label="Condition">{listing.condition}</AdminFact>
            <AdminFact label="Color">{listing.color ?? ADMIN_EMPTY_VALUE}</AdminFact>
            <AdminFact label="Sell mode">{listing.sell_mode}</AdminFact>
            <AdminFact label="Saved count">{listing.saved_count}</AdminFact>
            <AdminFact label="Created">{formatAdminDate(listing.created_at)}</AdminFact>
            <AdminFact label="Email">
              {listing.contact_email ?? ADMIN_EMPTY_VALUE}
            </AdminFact>
            <AdminFact label="Phone">
              {listing.contact_phone ?? ADMIN_EMPTY_VALUE}
            </AdminFact>
            <AdminFact label="Contact methods">
              {listing.contact_methods.length
                ? listing.contact_methods.join(", ")
                : ADMIN_EMPTY_VALUE}
            </AdminFact>
          </dl>
          {listing.description && (
            <p className="mt-4 text-sm text-(--muted-ink)">{listing.description}</p>
          )}
        </div>

        <div className="surface-panel hairline self-start rounded-2xl p-4">
          <AdminSectionHeading>Photos</AdminSectionHeading>
          <div className="mt-3 flex flex-wrap gap-3">
            {listing.image_urls.length === 0 ? (
              <p className="text-sm text-(--muted-ink)">No photos.</p>
            ) : (
              listing.image_urls.map((url, i) => (
                <div key={url} className="flex flex-col items-center gap-2">
                  <AdminThumbnail
                    src={url}
                    blurDataURL={listing.image_blur_data_urls[i]}
                    alt=""
                    size={96}
                  />
                  <AdminPendingActionButton
                    title="Remove this photo?"
                    description="A listing must keep at least one photo."
                    confirmLabel="Remove"
                    ariaLabel={`Remove photo ${i + 1}`}
                    icon="removeImage"
                    confirmVariant="destructive"
                    size="icon"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section>
        <AdminSectionHeading>Sizes</AdminSectionHeading>
        <AdminListPanel>
          {sizes.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span>
                Size {s.size}{" "}
                <span className="text-(--muted-ink)">· ${s.price}</span>
              </span>
              <span className="flex items-center gap-3">
                <span
                  className={
                    s.status === "sold" ? "text-(--sold)" : "text-[#2d7a4f]"
                  }
                >
                  {s.status === "sold" ? "Sold" : "Available"}
                </span>
                {s.status === "available" ? (
                  <AdminPendingActionButton
                    title={`Mark size ${s.size} sold?`}
                    description="Marks this one gown sold on the seller's behalf."
                    confirmLabel="Mark sold"
                    ariaLabel={`Mark size ${s.size} sold`}
                    icon="markSold"
                    size="icon"
                  />
                ) : (
                  <AdminPendingActionButton
                    title={`Reactivate size ${s.size}?`}
                    description="Returns this one gown to available."
                    confirmLabel="Reactivate"
                    ariaLabel={`Reactivate size ${s.size}`}
                    icon="reactivate"
                    size="icon"
                  />
                )}
              </span>
            </li>
          ))}
        </AdminListPanel>
      </section>

      <section>
        <AdminSectionHeading>Actions</AdminSectionHeading>
        <p className="mt-1 text-sm text-(--muted-ink)">
          Confirm dialogs open; writes are inert until Phase 3.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.status === "suspended" ? (
            <AdminPendingActionButton
              title="Restore listing?"
              description={`Restores the listing to ${listing.previous_status ?? "its previous status"}.`}
              confirmLabel="Restore"
              ariaLabel="Restore listing"
              buttonLabel="Restore"
              icon="restore"
            />
          ) : (
            <AdminPendingActionButton
              title="Suspend listing?"
              description="The seller will see a moderation notice with your reason."
              confirmLabel="Suspend"
              ariaLabel="Suspend listing"
              buttonLabel="Suspend"
              icon="ban"
              confirmVariant="destructive"
            />
          )}
          {listing.status === "active" && (
            <AdminPendingActionButton
              title="Mark listing sold?"
              description="Marks this listing and its sizes as sold on the seller's behalf."
              confirmLabel="Mark sold"
              ariaLabel="Mark listing sold"
              buttonLabel="Mark sold"
              icon="markSold"
            />
          )}
          {listing.status === "sold" && (
            <AdminPendingActionButton
              title="Reactivate listing?"
              description="Returns this listing to active on the seller's behalf."
              confirmLabel="Reactivate"
              ariaLabel="Reactivate listing"
              buttonLabel="Reactivate"
              icon="reactivate"
            />
          )}
        </div>
      </section>

      <section>
        <AdminSectionHeading>Payments</AdminSectionHeading>
        <div className="mt-3">
          <AdminTable
            headers={["Amount", "Status", "Session", "Created", "Paid"]}
            alignRight={[0, 3, 4]}
            isEmpty={payments.length === 0}
            empty={
              <p className="text-sm text-(--muted-ink)">No payment rows.</p>
            }
          >
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-right tabular-nums">
                  {formatCents(p.amount_cents)}
                </TableCell>
                <TableCell className="capitalize">{p.status}</TableCell>
                <TableCell className="font-mono text-xs text-(--muted-ink)">
                  <a
                    href={stripeSessionUrl(p.stripe_session_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {p.stripe_session_id}
                  </a>
                </TableCell>
                <TableCell className="text-right text-(--muted-ink)">
                  {formatAdminDate(p.created_at)}
                </TableCell>
                <TableCell className="text-right text-(--muted-ink)">
                  {p.paid_at ? formatAdminDate(p.paid_at) : ADMIN_EMPTY_VALUE}
                </TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </div>
      </section>

      <section>
        <AdminSectionHeading>Timeline</AdminSectionHeading>
        <AdminListPanel
          isEmpty={timeline.length === 0}
          emptyLabel="No audit events for this listing yet."
        >
          {timeline.map((entry) => (
            <li key={entry.id} className="px-4 py-3 text-sm">
              <p className="font-medium text-(--ink)">
                {entry.action}{" "}
                <span className="font-normal text-(--muted-ink)">
                  by {entry.actor_email}
                </span>
              </p>
              {entry.reason && (
                <p className="mt-0.5 text-xs text-(--muted-ink)">
                  {entry.reason}
                </p>
              )}
              <time
                className="mt-1 block text-xs text-(--muted-ink)"
                dateTime={entry.created_at}
              >
                {formatAdminDateTime(entry.created_at)}
              </time>
            </li>
          ))}
        </AdminListPanel>
      </section>
    </div>
  );
}
