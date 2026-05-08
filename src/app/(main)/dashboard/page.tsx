import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import type { Listing } from '@/lib/types';

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
import ListingRow from '@/components/ListingRow';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();


  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  const listings = (data ?? []) as Listing[];
  const hasListings = listings.length > 0;

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
            {hasListings
              ? `${listings.length} gown${listings.length === 1 ? '' : 's'} in your collection`
              : 'Curate your collection'}
          </p>
        </div>
        <Button
          asChild
          className="h-11 rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] transition hover:-translate-y-0.5 hover:brightness-105"
        >
          <Link href="/dashboard/new">
            <Plus data-icon="inline-start" />
            New Listing
          </Link>
        </Button>
      </header>

      {hasListings && <DashboardStats listings={listings} />}

      {!hasListings ? (
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
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
