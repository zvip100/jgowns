'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useWishlist } from '@/components/WishlistProvider';
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
  const { items, isOpen, open, close, isHydrated, removeItem } = useWishlist();

  return (
    <Sheet open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
      <SheetContent
        side="right"
        className="w-full max-w-sm border-[#d9c9b6] bg-[#fdf8f1] px-4 pt-12 pb-4 shadow-[0_24px_70px_rgba(74,52,30,0.22)] sm:max-w-sm"
      >
        <SheetTitle className="text-lg text-[#2f241b]">Wishlist</SheetTitle>
        <SheetDescription className="sr-only">
          Gowns you have saved for later.
        </SheetDescription>

        <Alert className="border-[#decdb8] bg-[#fff9f0] text-[#7b634b]">
          <AlertDescription>
            <span className="font-semibold text-[#5a4537]">
              Saved on this device only.
            </span>{' '}
            Your wishlist is stored in this browser and may be lost if you clear it.
          </AlertDescription>
        </Alert>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isHydrated && items.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Heart aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Your wishlist is empty</EmptyTitle>
                <EmptyDescription>
                  Save gowns you love from any listing page to find them here later.
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
