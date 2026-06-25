import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Sparkles } from 'lucide-react';

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

import type { Metadata } from 'next';
import type { Listing } from '@/lib/types';

export const metadata: Metadata = {
  title: "My Listings",
  description: "Manage your gown listings.",
  robots: { index: false, follow: false },
};

async function DashboardCollectionSummary({
  listingsPromise,
}: {
  listingsPromise: Promise<Listing[]>;
}) {
  const listings = await listingsPromise;

  if (listings.length === 0) return 'Curate your collection';
  return `${listings.length} gown${listings.length === 1 ? '' : 's'} in your collection`;
}

async function DashboardContent({
  listingsPromise,
}: {
  listingsPromise: Promise<Listing[]>;
}) {
  const listings = await listingsPromise;
  const hasListings = listings.length > 0;

  return (
    <>
      {hasListings ? (
        <>
          <DashboardStats listings={listings} />
          <div className="flex flex-col gap-3">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} />
            ))}
          </div>
        </>
      ) : (
        <Empty className="surface-panel hairline rounded-[1.8rem] py-16 sm:py-20">
          <EmptyHeader>
            <EmptyMedia className="text-5xl">👗</EmptyMedia>
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

  async function fetchUserListings(): Promise<Listing[]> {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    return (data ?? []) as Listing[];
  }

  const listingsPromise = fetchUserListings();

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
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
