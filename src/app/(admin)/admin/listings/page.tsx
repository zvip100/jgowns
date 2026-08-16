import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { listingPriceSummary } from "@/lib/listing-variants";

import { AdminListPage } from "../../AdminListPage";
import { AdminThumbnail } from "../../AdminThumbnail";
import { adminCategoryLabel } from "../../admin-audit-labels";
import { FIXTURE_AS_OF, FIXTURE_LISTINGS } from "../../admin-fixtures";
import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
  ADMIN_STUCK_PAYMENT_SEGMENT,
  buildAdminListResult,
  filterByDateRange,
  matchesListingSegment,
  parseAdminListParams,
  sortByCreatedDesc,
} from "../../admin-list";
import { toListingWithSizes } from "../../admin-types";
import { formatAdminDate } from "../../admin-url";
import { StatusPill } from "../../StatusPill";

import type { AdminListResult } from "../../admin-list";
import type { AdminListing } from "../../admin-types";

import type { Metadata } from "next";
import type { PageSearchParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Listings",
  description: "All marketplace listings.",
  robots: { index: false, follow: false },
};

// Status first, then the three age queues the overview cards link to. They
// share this row rather than getting a control of their own: they are still
// one choice of "which listings", and the row already wraps.
const STATUS_SEGMENTS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "pending_payment", label: "Payment required" },
  { value: ADMIN_OFF_MARKET_STATUS, label: "Off market" },
  { value: "suspended", label: "Suspended" },
  { value: "removed", label: "Removed" },
  { value: ADMIN_NEW_WEEK_SEGMENT, label: "New this week" },
  { value: ADMIN_STALE_ACTIVE_SEGMENT, label: "Stale actives" },
  { value: ADMIN_STUCK_PAYMENT_SEGMENT, label: "Stuck payments" },
];

type AdminListingsPageProps = {
  searchParams: Promise<PageSearchParams>;
};

async function loadListings(
  searchParams: Promise<PageSearchParams>,
): Promise<AdminListResult<AdminListing>> {
  const params = parseAdminListParams(await searchParams);

  let filtered = FIXTURE_LISTINGS.filter((l) =>
    matchesListingSegment(params.status, l, FIXTURE_AS_OF),
  );
  if (params.query) {
    filtered = filtered.filter((l) =>
      l.title.toLowerCase().includes(params.query),
    );
  }
  filtered = filterByDateRange(filtered, params, (l) => l.created_at);

  const sorted = sortByCreatedDesc(filtered);

  return buildAdminListResult(sorted, params);
}

export default function AdminListingsPage({
  searchParams,
}: AdminListingsPageProps) {
  return (
    <AdminListPage
      basePath="/admin/listings"
      title="Listings"
      countNoun="listing"
      segments={STATUS_SEGMENTS}
      searchPlaceholder="Search by title"
      headers={[
        "Listing",
        "Seller",
        "Category",
        "Price",
        "Sizes",
        "Status",
        "Saved",
        "Created",
      ]}
      alignRight={[3, 4, 6, 7]}
      emptyTitle="No listings match"
      emptyDescription="Try clearing filters or searching a different title."
      resultPromise={loadListings(searchParams)}
      renderRow={(listing) => {
        const available = listing.sizes.filter(
          (s) => s.status === "available",
        ).length;

        return (
          <TableRow key={listing.id}>
            <TableCell className="whitespace-normal">
              <Link
                href={`/admin/listings/${listing.id}`}
                className="flex items-center gap-3 font-medium text-(--ink) hover:text-(--accent-deep)"
              >
                <AdminThumbnail
                  src={listing.image_urls[0]}
                  blurDataURL={listing.image_blur_data_urls[0]}
                  alt=""
                />
                <span className="line-clamp-2 w-44">{listing.title}</span>
              </Link>
            </TableCell>
            <TableCell className="text-(--muted-ink)">
              <Link
                href={`/admin/users/${listing.user_id}`}
                className="hover:text-(--accent-deep)"
              >
                {listing.seller_email}
              </Link>
            </TableCell>
            <TableCell>{adminCategoryLabel(listing.category)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {listingPriceSummary(toListingWithSizes(listing))}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {available}/{listing.sizes.length}
            </TableCell>
            <TableCell>
              <StatusPill status={listing.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {listing.saved_count}
            </TableCell>
            <TableCell className="text-right text-(--muted-ink)">
              {formatAdminDate(listing.created_at)}
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}
