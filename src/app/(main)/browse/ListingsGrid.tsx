import { Flower2, Plus, SearchX, TriangleAlert } from "lucide-react";

import { SellCtaLink } from "@/components/SellCtaLink";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { hasBrowseFilters } from "@/lib/browse-filters";
import { browseQueryString } from "@/lib/browse-url";
import { decodeSizeFilterToken } from "@/lib/gown-sizes";
import { PRIMARY_CTA_PILL_CLASS } from "@/lib/styles";
import type {
  BrowseFilters,
  ListingReadError,
  ListingWithSizes,
} from "@/lib/types";

import GownCard from "./GownCard";
import ListingsGridWrap from "./ListingsGridWrap";

const EMPTY_SHELL_CLASS =
  "surface-panel hairline rounded-[1.8rem] border-0 py-20 text-[#8e7962]";

type ListingsGridProps = {
  listings: ListingWithSizes[] | null;
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
      <Empty className='surface-panel hairline rounded-[1.8rem] border-0 py-20 text-[#8e7962]'>
        <EmptyHeader>
          <EmptyMedia className='mb-2 size-auto bg-transparent text-6xl text-[#a02238]'>
            <TriangleAlert className='size-12' strokeWidth={1.4} />
          </EmptyMedia>
          <EmptyTitle className='text-base font-medium text-[#a02238]'>
            Couldn&apos;t load gowns
          </EmptyTitle>
          <EmptyDescription className='text-[#8e7962]'>
            Please try again in a moment.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  /* Two different empties: a search that matched nothing is the visitor's to
     fix, an empty marketplace is ours. Telling someone to adjust filters they
     never set is the wrong instruction and offers them nothing to do. */
  if (totalCount === 0) {
    if (hasBrowseFilters(filters)) {
      return (
        <Empty className={EMPTY_SHELL_CLASS}>
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
      <Empty className={EMPTY_SHELL_CLASS}>
        <EmptyHeader>
          <EmptyMedia className='mb-2 size-auto bg-transparent text-6xl text-[#bca88f]'>
            <Flower2 className='size-12' strokeWidth={1.4} />
          </EmptyMedia>
          <EmptyTitle className='text-base font-medium text-[#8e7962]'>
            No gowns yet
          </EmptyTitle>
          <EmptyDescription className='text-[#8e7962]'>
            Be the first to list.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <SellCtaLink
            placement='browse_empty'
            className={`inline-flex items-center gap-2 ${PRIMARY_CTA_PILL_CLASS}`}
          >
            <Plus className='size-4' />
            List Your Gown
          </SellCtaLink>
        </EmptyContent>
      </Empty>
    );
  }

  const matchedSizePairs = (filters.size ?? [])
    .map((token) => decodeSizeFilterToken(token))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <ListingsGridWrap>
      {(listings ?? []).map((listing) => (
        <GownCard
          key={listing.id}
          listing={listing}
          backQuery={backQuery}
          matchedSizePairs={matchedSizePairs}
        />
      ))}
    </ListingsGridWrap>
  );
}
