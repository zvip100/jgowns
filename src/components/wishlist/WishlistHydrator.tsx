'use client';

import { useEffect } from 'react';

import { useWishlist } from '@/components/wishlist/WishlistProvider';

import type { WishlistItem } from '@/lib/types';

type WishlistHydratorProps = {
  isAuthenticated: boolean;
  userId: string | null;
  serverItems: WishlistItem[] | null;
};

/**
 * Injects the server-fetched account wishlist into the provider. Re-runs when
 * the server sends a new payload (initial load, and after a sign-in/out
 * revalidates the layout) so the provider re-reconciles on auth changes even
 * across soft navigations. Rendered inside a Suspense boundary by
 * `WishlistServerSync` so the auth + wishlist read streams without blocking the
 * static shell.
 */
export function WishlistHydrator({
  isAuthenticated,
  userId,
  serverItems,
}: WishlistHydratorProps) {
  const { syncFromServer } = useWishlist();

  useEffect(() => {
    syncFromServer({ isAuthenticated, userId, items: serverItems });
  }, [isAuthenticated, userId, serverItems, syncFromServer]);

  return null;
}
