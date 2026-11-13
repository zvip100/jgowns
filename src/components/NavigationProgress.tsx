"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  commitNavigationProgress,
  getNavigationProgress,
  subscribeNavigationProgress,
} from "@/lib/navigation-progress";

import type { ReactNode } from "react";

/**
 * Top loading bar for client-side navigations. The route tracker is a separate
 * leaf so its navigation hooks suspend without holding back the bar itself.
 */
export default function NavigationProgress(): ReactNode {
  const { id, isPending } = useSyncExternalStore(
    subscribeNavigationProgress,
    getNavigationProgress,
    getNavigationProgress,
  );

  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgressRouteTracker />
      </Suspense>
      <div
        aria-hidden="true"
        data-pending={isPending}
        className="navigation-progress"
      >
        <span key={id} />
      </div>
    </>
  );
}

function NavigationProgressRouteTracker(): null {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    commitNavigationProgress(pathname, search);
  }, [pathname, search]);

  return null;
}
