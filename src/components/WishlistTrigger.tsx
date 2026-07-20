'use client';

import { Heart } from 'lucide-react';

import { useWishlist } from '@/components/WishlistProvider';
import { WISHLIST_HEART_BUTTON_CLASS, WISHLIST_HEART_UNSAVED_CLASS } from '@/lib/styles';
import { cn } from '@/lib/utils';

type WishlistTriggerProps = {
  className?: string;
};

export function WishlistTrigger({ className }: WishlistTriggerProps) {
  const { count, toggle } = useWishlist();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open wishlist"
      className={cn(
        'relative',
        WISHLIST_HEART_BUTTON_CLASS,
        WISHLIST_HEART_UNSAVED_CLASS,
        className,
      )}
    >
      <Heart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full gold-gradient px-1 py-0.5 text-[0.6rem] font-semibold leading-none text-white shadow-[0_4px_12px_rgba(166,120,65,0.35)]"
        >
          {count}
        </span>
      )}
    </button>
  );
}
