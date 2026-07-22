'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LEGAL_LINK_CLASS } from '@/lib/styles';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useWishlist } from '@/components/wishlist/WishlistProvider';
import { blurProps, cn } from '@/lib/utils';

import type { WishlistItem, WishlistItemStatus } from '@/lib/types';

function statusChipLabel(status: WishlistItemStatus): string | null {
  if (status === 'sold') return 'Sold';
  if (status === 'unavailable') return 'No longer available';
  return null;
}

type WishlistRowProps = {
  item: WishlistItem;
  onRemove: (listingId: string) => void;
  onNavigate: () => void;
};

function WishlistRow({ item, onRemove, onNavigate }: WishlistRowProps) {
  const { snapshot } = item;
  const dimmed = item.status !== 'active';
  const isNavigable = item.status !== 'unavailable';
  const chipLabel = statusChipLabel(item.status);

  const body = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#efe7dc]">
        {snapshot.image && (
          <Image
            src={snapshot.image}
            alt={snapshot.title}
            fill
            sizes="64px"
            className={cn('object-cover', dimmed && 'grayscale')}
            {...blurProps(snapshot.blurDataUrl ?? undefined)}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            dimmed ? 'text-[#9c8a76]' : 'text-[#3f3025]',
          )}
        >
          {snapshot.title}
        </p>
        <p className={cn('text-sm', dimmed ? 'text-[#b3a18c]' : 'text-[#8a6232]')}>
          {snapshot.priceLabel}
        </p>
        {chipLabel && (
          <Badge
            variant="outline"
            className="mt-1 h-auto rounded-full border-[#decdb8] bg-[#fff9f0] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-[#8a7462]"
          >
            {chipLabel}
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2 py-3">
      {isNavigable ? (
        <Link
          href={`/browse/${item.listingId}`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
        >
          {body}
        </Link>
      ) : (
        <div aria-disabled="true" className="flex min-w-0 flex-1 items-center gap-3 opacity-70">
          {body}
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove(item.listingId)}
        aria-label={`Remove ${snapshot.title} from wishlist`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#a08a72] transition-colors hover:bg-[#fff9f0] hover:text-[#b3541e]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function WishlistSheet() {
  const { items, isOpen, open, close, isHydrated, isAuthenticated, removeItem } =
    useWishlist();
  const [signInHref, setSignInHref] = useState('/login');

  // Build the sign-in link from window (not useSearchParams) so this layout-root
  // client component never forces the (main) tree into client-side rendering.
  // Folds `wishlist=open` into `next` so the drawer auto-reopens after login.
  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    params.set('wishlist', 'open');
    const returnPath = `${window.location.pathname}?${params.toString()}`;
    setSignInHref(`/login?next=${encodeURIComponent(returnPath)}`);
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-sm border-[#d9c9b6] bg-[#fdf8f1] px-4 pt-5 pb-4 shadow-[0_24px_70px_rgba(74,52,30,0.22)] sm:max-w-sm"
      >
        <div className={cn('flex flex-col gap-4', isAuthenticated ? 'mb-20' : 'mb-10')}>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-2xl text-[#2f241b]">Wishlist</SheetTitle>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Close wishlist"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[#decdb8] bg-[#fff9f0] text-[#a08a72] transition-colors hover:text-[#8a6232]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            Gowns you have saved for later.
          </SheetDescription>

          {!isAuthenticated && (
            <Alert className="border-[#decdb8] bg-[#fff9f0] text-[#7b634b]">
              <AlertDescription className="flex flex-col gap-1">
                <span className="font-semibold text-[#5a4537]">
                  Saved on this device only.
                </span>
                <span>
                  <Link href={signInHref} onClick={close} className={LEGAL_LINK_CLASS}>
                    Sign in
                  </Link>{' '}
                  to save to your account.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isHydrated && items.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Heart aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Your wishlist is empty</EmptyTitle>
                <EmptyDescription>
                  Save your favorite gowns to easily find them later.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {isHydrated && items.length > 0 && (
            <div className="divide-y divide-[#f0e7d8]">
              {items.map((item) => (
                <WishlistRow
                  key={item.listingId}
                  item={item}
                  onRemove={removeItem}
                  onNavigate={close}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
