import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { FormInfoBanner } from "@/components/form/FormInfoBanner";
import { TableCell, TableRow } from "@/components/ui/table";
import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { isAdminDemoMode } from "@/lib/admin/demo";
import { toListingWithSizes } from "@/lib/admin/types";
import {
  listingPriceSummary,
  sortListingSizes,
} from "@/lib/listing-variants";
import { getAdminListing } from "@/lib/queries/admin/listings";
import { getAuditLogForListing } from "@/lib/queries/admin/logs";
import { getAdminPaymentsFor } from "@/lib/queries/admin/payments";
import {
  SUSPENSION_SLUG_LABELS,
  sellerSuspensionMessage,
} from "@/lib/suspension";

import { AdminFact } from "../../../AdminFact";
import { AdminListPanel } from "../../../AdminListPanel";
import { AdminPageHeader } from "../../../AdminPageHeader";
import { AdminSectionHeading } from "../../../AdminSectionHeading";
import { AdminTable } from "../../../AdminTable";
import { AdminThumbnail } from "../../../AdminThumbnail";
import { AuditActionPill } from "../../../AuditActionPill";
import { AuditActorGlyph } from "../../../AuditActorGlyph";
import { StatusPill } from "../../../StatusPill";
import {
  AdminMarkListingSoldButton,
  AdminMarkSizeSoldButton,
  AdminReactivateListingButton,
  AdminReactivateSizeButton,
  AdminRemoveImageButton,
  AdminRemoveListingButton,
  AdminRestoreListingButton,
  AdminSuspendListingButton,
} from "../../../admin-action-buttons";
import {
  ADMIN_SELL_MODE_LABELS,
  adminCategoryLabel,
  auditActorName,
} from "../../../admin-audit-labels";
import {
  FIXTURE_PAYMENTS,
  demoAuditLogForListing,
  getFixtureListing,
} from "../../../admin-fixtures";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatCents,
  stripeSessionUrl,
} from "../../../admin-url";

import type { Metadata } from "next";
import type { AdminListingStatus } from "@/lib/admin/types";

type AdminListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Mirrors admin_restore_listing's own CASE for a removed listing (§4.3
 * migration 034): active only if the listing had already gone live before
 * removal, pending_payment otherwise (including a legacy row with no
 * previous_status at all, on the safe side of that ambiguity).
 */
function removedRestoreTarget(
  previousStatus: AdminListingStatus | null,
): AdminListingStatus {
  return previousStatus === "active" || previousStatus === "sold"
    ? "active"
    : "pending_payment";
}

/** Deduped so generateMetadata and the page body share one read. */
const loadListing = cache(async (id: string) => {
  if (await isAdminDemoMode()) return getFixtureListing(id) ?? null;
  return getAdminListing(id);
});

export async function generateMetadata({
  params,
}: AdminListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await loadListing(id);
  return {
    title: listing?.title ?? "Listing",
    robots: { index: false, follow: false },
  };
}

export default async function AdminListingDetailPage({
  params,
}: AdminListingDetailPageProps) {
  const { id } = await params;
  const isDemo = await isAdminDemoMode();
  const listing = await loadListing(id);
  if (!listing) notFound();

  const [payments, timeline] = isDemo
    ? [
        FIXTURE_PAYMENTS.filter((p) => p.listing_id === listing.id),
        demoAuditLogForListing(listing.id),
      ]
    : await Promise.all([
        getAdminPaymentsFor({ listingId: listing.id }),
        getAuditLogForListing(listing.id),
      ]);

  const category = adminCategoryLabel(listing.category);
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

      {listing.status === "suspended" && (
        <FormInfoBanner icon={Ban}>
          <strong>
            Suspended:{" "}
            {listing.suspension_slug
              ? SUSPENSION_SLUG_LABELS[listing.suspension_slug]
              : "reason not recorded"}
            .
          </strong>{" "}
          {sellerSuspensionMessage(
            listing.suspension_slug,
            listing.suspension_reason,
          )}
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
            <AdminFact label="Sell mode">
              {ADMIN_SELL_MODE_LABELS[listing.sell_mode]}
            </AdminFact>
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
                  <AdminRemoveImageButton
                    listingId={listing.id}
                    imageUrl={url}
                    position={i + 1}
                    isDemo={isDemo}
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
                {/* Both RPCs require an active parent, so on any other status
                    every one of these buttons is a guaranteed failure. Mirrors
                    ListingRow's showPerSizeActions. */}
                {listing.status === "active" &&
                  (s.status === "available" ? (
                    <AdminMarkSizeSoldButton
                      listingId={listing.id}
                      sizeId={s.id}
                      size={s.size}
                      isDemo={isDemo}
                    />
                  ) : (
                    <AdminReactivateSizeButton
                      listingId={listing.id}
                      sizeId={s.id}
                      size={s.size}
                      isDemo={isDemo}
                    />
                  ))}
              </span>
            </li>
          ))}
        </AdminListPanel>
      </section>

      <section>
        <AdminSectionHeading>Actions</AdminSectionHeading>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.status === "suspended" || listing.status === "removed" ? (
            <AdminRestoreListingButton
              listingId={listing.id}
              previousStatus={
                listing.status === "suspended"
                  ? listing.previous_status
                  : removedRestoreTarget(listing.previous_status)
              }
              isDemo={isDemo}
            />
          ) : (
            <>
              <AdminSuspendListingButton listingId={listing.id} isDemo={isDemo} />
              <AdminRemoveListingButton listingId={listing.id} isDemo={isDemo} />
            </>
          )}
          {listing.status === "active" && (
            <AdminMarkListingSoldButton listingId={listing.id} isDemo={isDemo} />
          )}
          {listing.status === "sold" && (
            <AdminReactivateListingButton
              listingId={listing.id}
              isDemo={isDemo}
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
            <li key={entry.id} className="flex gap-2 px-4 py-3 text-sm">
              <AuditActorGlyph role={entry.actor_role} className="mt-0.5" />
              <div className="min-w-0">
                <AuditActionPill action={entry.action} />
                <p className="mt-1 text-xs text-(--muted-ink)">
                  by {auditActorName(entry.actor_email, entry.actor_role)}
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
              </div>
            </li>
          ))}
        </AdminListPanel>
      </section>
    </div>
  );
}
