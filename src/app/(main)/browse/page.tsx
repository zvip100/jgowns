import { Suspense } from "react";

import BrowseCategoryNav from "@/components/BrowseCategoryNav";
import ListingsCount from "@/components/ListingsCount";
import ListingsGrid from "@/components/ListingsGrid";
import ListingsLayout from "@/components/ListingsLayout";
import ListingsSkeleton from "@/components/ListingsSkeleton";
import type { PageSearchParams } from "@/lib/types";
import { fetchPriceBounds } from "@/lib/listings-queries";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const { minBound, maxBound } = await fetchPriceBounds();
  const resolvedSearchParams = await searchParams;

  // lg:-mt-10 cancels (main)/layout.tsx's desktop top padding so the filter
  // rail sits flush against the navbar's bottom edge. Mobile keeps the
  // natural padding so the drawer trigger has breathing room.
  return (
    <div className='lg:-mt-10'>
      <ListingsLayout
        minBound={minBound}
        maxBound={maxBound}
        categoryNavMobile={
          <BrowseCategoryNav variant='mobile' searchParams={resolvedSearchParams} />
        }
        categoryNavDesktop={
          <BrowseCategoryNav
            variant='desktop'
            searchParams={resolvedSearchParams}
          />
        }
        count={
          <Suspense fallback={null}>
            <ListingsCount searchParams={searchParams} />
          </Suspense>
        }
        cards={
          <Suspense fallback={<ListingsSkeleton />}>
            <ListingsGrid searchParams={searchParams} />
          </Suspense>
        }
      />
    </div>
  );
}
