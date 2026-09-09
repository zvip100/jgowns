import type { Metadata } from "next";
import { Suspense } from "react";

import type { PageSearchParams } from "@/lib/types";
import { fetchPriceBounds } from "@/lib/queries/listings";

import BrowseCategoryNav from "./BrowseCategoryNav";
import BrowseListings from "./BrowseListings";
import ListingsLayout from "./ListingsLayout";
import ListingsSkeleton from "./ListingsSkeleton";

export const metadata: Metadata = {
  title: "Browse Modest Gowns",
  description:
    "Shop pre-loved modest gowns. Filter by size, category, price, and location to find your perfect match.",
  openGraph: {
    title: "Browse Modest Gowns | JGowns",
    description:
      "Shop pre-loved modest gowns. Filter by size, category, price, and location to find your perfect match.",
    type: "website",
  },
};

type BrowsePageProps = {
  searchParams: Promise<PageSearchParams>;
};

export default async function BrowsePage({
  searchParams,
}: BrowsePageProps) {
  const { minBound, maxBound } = await fetchPriceBounds();

  return (
    <div className='-mt-4 lg:-mt-10'>
      <ListingsLayout
        minBound={minBound}
        maxBound={maxBound}
        categoryNavMobile={
          <Suspense fallback={null}>
            <BrowseCategoryNav variant='mobile' searchParams={searchParams} />
          </Suspense>
        }
        categoryNavDesktop={
          <Suspense fallback={null}>
            <BrowseCategoryNav variant='desktop' searchParams={searchParams} />
          </Suspense>
        }
        listings={
          <Suspense fallback={<ListingsSkeleton />}>
            <BrowseListings searchParams={searchParams} />
          </Suspense>
        }
      />
    </div>
  );
}
