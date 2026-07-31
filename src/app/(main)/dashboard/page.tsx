import Link from 'next/link';
import { Suspense } from 'react';
import { PackageOpen, Plus, Sparkles } from 'lucide-react';

import { isListingFeeActive } from '@/lib/listing-fee';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import DashboardStats from '@/components/DashboardStats';
import DashboardPageSkeleton from '@/components/DashboardPageSkeleton';
import ListingRow from '@/components/ListingRow';

import { DashboardFlashToast } from './DashboardFlashToast';

import type { Metadata } from 'next';
import type { ListingWithSizes } from '@/lib/types';

export const metadata: Metadata = {
  title: "My Listings",
  description: "Manage your gown listings.",
  robots: { index: false, follow: false },
};

type DashboardCollectionSummaryProps = {
  listingsPromise: Promise<ListingWithSizes[]>;
};

type DashboardContentProps = {
  listingsPromise: Promise<ListingWithSizes[]>;
};

async function DashboardCollectionSummary({
  listingsPromise,
}: DashboardCollectionSummaryProps) {
  const listings = await listingsPromise;
  const gownCount = listings.reduce((sum, l) => sum + l.sizes.length, 0);

  if (gownCount === 0) return 'Curate your collection';
  return `${gownCount} gown${gownCount === 1 ? '' : 's'} in your collection`;
}

async function DashboardContent({
  listingsPromise,
}: DashboardContentProps) {
  const listings = await listingsPromise;
  const hasListings = listings.length > 0;
  const listingFeeActive = isListingFeeActive();

  return (
    <>
      {hasListings ? (
        <>
          <DashboardStats listings={listings} />
          <div className="flex flex-col gap-3">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} listingFeeActive={listingFeeActive} />
            ))}
          </div>
        </>
      ) : (
        <Empty className="surface-panel hairline rounded-[1.8rem] py-16 sm:py-20">
          <EmptyHeader>
            <EmptyMedia>
              <PackageOpen className="size-12 text-(--accent-deep)" strokeWidth={1.5} aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="font-display text-xl text-(--ink)">
              Your wardrobe is empty
            </EmptyTitle>
            <EmptyDescription>
              List your first gown and reach buyers in your community.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              asChild
              variant="ghost"
              className="text-(--accent-deep) hover:text-(--ink)"
            >
              <Link href="/dashboard/new">
                <Sparkles data-icon="inline-start" />
                List your first gown
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  async function fetchUserListings(): Promise<ListingWithSizes[]> {
    const { data } = await supabase
      .from('listings')
      .select('*, sizes:listing_sizes(*)')
      .eq('user_id', user!.id)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    return (data ?? []) as ListingWithSizes[];
  }

  const listingsPromise = fetchUserListings();

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <DashboardFlashToast />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
            Your Boutique
          </p>
          <h1 className="mt-2 font-display text-[2rem] leading-tight text-(--ink) sm:text-[2.4rem]">
            My Listings
          </h1>
          <p className="mt-1 text-sm text-(--muted-ink)">
            <Suspense fallback="Gathering your collection...">
              <DashboardCollectionSummary listingsPromise={listingsPromise} />
            </Suspense>
          </p>
        </div>
        <Button
          asChild
          className="h-11 rounded-full border border-[#b58d5f]/70 gold-gradient px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] transition hover:-translate-y-0.5 hover:brightness-105"
        >
          <Link href="/dashboard/new">
            <Plus data-icon="inline-start" />
            New Listing
          </Link>
        </Button>
      </header>

      <Suspense fallback={<DashboardPageSkeleton />}>
        <DashboardContent listingsPromise={listingsPromise} />
      </Suspense>
    </div>
  );
}
