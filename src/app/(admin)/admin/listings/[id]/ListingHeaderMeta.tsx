import { AdminExternalLink } from "../../../AdminExternalLink";
import { StatusPill } from "../../../StatusPill";

import type { AdminListingStatus } from "@/lib/admin/types";

type ListingHeaderMetaProps = {
  listingId: string;
  status: AdminListingStatus;
  priceSummary: string;
};

/** The public page serves only active and sold listings; any other status 404s. */
export function ListingHeaderMeta({
  listingId,
  status,
  priceSummary,
}: ListingHeaderMetaProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <StatusPill status={status} />
      <span className="text-sm text-(--muted-ink)">{priceSummary}</span>
      {(status === "active" || status === "sold") && (
        <AdminExternalLink href={`/browse/${listingId}`}>
          View listing
        </AdminExternalLink>
      )}
    </div>
  );
}
