import { unstable_rethrow } from "next/navigation";

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
      serverItems = await getUserWishlist(user.id);
    }
  } catch (error) {
    // Prerender abandoning this dynamic read is not a failure: the static shell
    // completes and the cookie read is dropped, on every prerendered route.
    // Logging it buried a real read failure in noise, and swallowing it hid a
    // signal the framework handles itself. unstable_rethrow covers exactly that
    // case (hanging promise rejection) and returns for anything genuine, so the
    // degrade-to-null below is unchanged.
    unstable_rethrow(error);
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
