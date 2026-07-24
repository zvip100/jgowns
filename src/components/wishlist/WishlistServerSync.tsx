import { getCurrentUser } from "@/lib/queries/auth";
import { getUserWishlist } from "@/lib/queries/wishlist";
import { WishlistHydrator } from "@/components/wishlist/WishlistHydrator";

import type { WishlistItem } from "@/lib/types";

/**
 * Streams the signed-in user's account wishlist into the client provider (T1).
 * Runs inside a Suspense boundary so this dynamic auth read never blocks the
 * static shell. A read failure degrades to `null` (keep the local mirror)
 * instead of throwing and tripping the route error boundary.
 */
export default async function WishlistServerSync() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let serverItems: WishlistItem[] | null = null;

  try {
    user = await getCurrentUser();
    if (user) {
      serverItems = await getUserWishlist();
    }
  } catch (error) {
    console.error("[WishlistServerSync] Failed to load account wishlist", error);
  }

  return (
    <WishlistHydrator
      isAuthenticated={Boolean(user)}
      userId={user?.id ?? null}
      serverItems={serverItems}
    />
  );
}
