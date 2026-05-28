import { redirect } from "next/navigation";

import BrowsePagination from "@/components/BrowsePagination";
import ListingsGrid from "@/components/ListingsGrid";
import { parseBrowseFilters } from "@/lib/browse-filters";
import {
  browsePageRedirectTarget,
  parseBrowsePage,
} from "@/lib/browse-pagination";
import { browseHref } from "@/lib/browse-url";
import { fetchListingsPage } from "@/lib/listings-queries";
import type { PageSearchParams } from "@/lib/types";

export default async function BrowseListings({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolved = await searchParams;
  const filters = parseBrowseFilters(resolved);
  const page = parseBrowsePage(resolved);
  const result = await fetchListingsPage(filters, page);

  const redirectPage = browsePageRedirectTarget(
    page,
    result.totalPages,
    result.totalCount,
  );
  if (redirectPage !== null) {
    redirect(browseHref(filters, redirectPage));
  }

  const showPagination = !result.error && result.totalCount > 0;

  return (
    <>
      <p
        className='mb-4 text-right text-[0.8125rem] leading-snug text-[#9a8770] sm:text-sm'
        aria-live='polite'
      >
        {result.totalCount.toLocaleString()} active listings
      </p>
      <ListingsGrid
        listings={result.listings}
        error={result.error}
        totalCount={result.totalCount}
        page={page}
        filters={filters}
      />
      {showPagination ? (
        <BrowsePagination
          page={page}
          totalPages={result.totalPages}
          searchParams={resolved}
        />
      ) : null}
    </>
  );
}
