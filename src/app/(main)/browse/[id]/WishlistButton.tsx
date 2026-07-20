'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

import { useWishlist } from '@/components/WishlistProvider';
import {
  WISHLIST_HEART_BUTTON_CLASS,
  WISHLIST_HEART_SAVED_CLASS,
  WISHLIST_HEART_UNSAVED_CLASS,
} from '@/lib/styles';
import { cn } from '@/lib/utils';

type WishlistButtonProps = {
  listingId: string;
  title: string;
  priceLabel: string;
  image: string | null;
  blurDataUrl: string | null;
  status: 'active' | 'sold';
};

export function WishlistButton({
  listingId,
  title,
  priceLabel,
  image,
  blurDataUrl,
  status,
}: WishlistButtonProps) {
  const { isSaved, toggleItem, isHydrated } = useWishlist();
  const [error, setError] = useState<string | null>(null);

  // Before hydration, always render unsaved — localStorage hasn't been read
  // yet, so trusting it here would flash the wrong state.
  const saved = isHydrated && isSaved(listingId);

  function handleClick() {
    const result = toggleItem(
      listingId,
      { title, priceLabel, image, blurDataUrl },
      status,
    );
    setError(result);
    if (result) {
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={
          saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`
        }
        className={cn(
          WISHLIST_HEART_BUTTON_CLASS,
          saved ? WISHLIST_HEART_SAVED_CLASS : WISHLIST_HEART_UNSAVED_CLASS,
        )}
      >
        <Heart
          className={cn('size-5', saved && 'fill-current')}
          aria-hidden="true"
        />
      </button>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs font-medium text-[#b3541e]">
          {error}
        </p>
      )}
    </div>
  );
}
