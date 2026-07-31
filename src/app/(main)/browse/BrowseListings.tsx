import { redirect } from "next/navigation";

import { parseBrowseFilters } from "@/lib/browse-filters";
import {
  browsePageRedirectTarget,
  parseBrowsePage,
} from "@/lib/browse-pagination";
import { browseHref } from "@/lib/browse-url";
import { fetchListingsPage } from "@/lib/queries/listings";
import type { PageSearchParams } from "@/lib/types";

import BrowsePagination from "./BrowsePagination";
import ListingsGrid from "./ListingsGrid";

type BrowseListingsProps = {
  searchParams: Promise<PageSearchParams>;
};

export default async function BrowseListings({
  searchParams,
}: BrowseListingsProps) {
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
      {!result.error && (
        <p
          className='mb-4 text-right text-[0.8125rem] leading-snug text-[#9a8770] sm:text-sm'
          aria-live='polite'
        >
          {result.totalCount.toLocaleString()} active listings
        </p>
      )}
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
