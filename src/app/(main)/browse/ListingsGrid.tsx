import { SearchX } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { browseQueryString } from "@/lib/browse-url";
import type {
  BrowseFilters,
  Listing,
  ListingReadError,
} from "@/lib/types";

import GownCard from "./GownCard";
import ListingsGridWrap from "./ListingsGridWrap";

type ListingsGridProps = {
  listings: Listing[] | null;
  error: ListingReadError | null;
  totalCount: number;
  page: number;
  filters: BrowseFilters;
};

export default function ListingsGrid({
  listings,
  error,
  totalCount,
  page,
  filters,
}: ListingsGridProps) {
  const backQuery = browseQueryString(filters, page) || undefined;

  if (error) {
    return (
      <div className='rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
        Could not load gowns right now. {error.message}
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <Empty className='surface-panel hairline rounded-[1.8rem] border-0 py-20 text-[#8e7962]'>
        <EmptyHeader>
          <EmptyMedia className='mb-2 size-auto bg-transparent text-6xl text-[#bca88f]'>
            <SearchX className='size-12' strokeWidth={1.4} />
          </EmptyMedia>
          <EmptyTitle className='text-base font-medium text-[#8e7962]'>
            No gowns found
          </EmptyTitle>
          <EmptyDescription className='text-[#8e7962]'>
            Try adjusting your filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ListingsGridWrap>
      {(listings ?? []).map((listing: Listing) => (
        <GownCard key={listing.id} listing={listing} backQuery={backQuery} />
      ))}
    </ListingsGridWrap>
  );
}
