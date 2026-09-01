"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  formatRefreshedAt,
  getAdminRouteKey,
  rememberRefreshedAt,
  scheduleAdminRefresh,
} from "./admin-refresh";

import type { ReactNode } from "react";
import type { RefreshedAtLabel } from "./admin-refresh";

type AdminRefreshContextValue = {
  isPending: boolean;
  refreshed: RefreshedAtLabel | null;
  registerRoute: (routeKey: string) => () => void;
  startRefresh: () => void;
};

export const AdminRefreshContext =
  createContext<AdminRefreshContextValue | null>(null);

type AdminRefreshProviderProps = {
  children: ReactNode;
};

/**
 * Owns one refresh lifecycle for the whole portal. The route observer is a
 * separate leaf so its navigation hooks suspend without taking page content
 * out of the server-rendered shell.
 */
export function AdminRefreshProvider({
  children,
}: AdminRefreshProviderProps): ReactNode {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const routeKeyRef = useRef("");
  const isRefreshingRef = useRef(false);
  const historyRestoreKeyRef = useRef<string | null>(null);
  const hasJustCommittedRouteRef = useRef(false);
  const refreshedAtByRouteRef = useRef(new Map<string, number>());

  const startRefresh = useCallback((): void => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const markRefreshed = useCallback((key: string): void => {
    const now = Date.now();
    rememberRefreshedAt(refreshedAtByRouteRef.current, key, now);
    setLastRefreshedAt(now);
  }, []);

  useEffect(() => {
    function handlePopState(): void {
      const restoredKey = getAdminRouteKey(
        window.location.pathname,
        window.location.search,
      );
      if (
        hasJustCommittedRouteRef.current ||
        restoredKey !== routeKeyRef.current
      ) {
        historyRestoreKeyRef.current = restoredKey;
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const registerRoute = useCallback(
    (routeKey: string): (() => void) => {
      routeKeyRef.current = routeKey;
      hasJustCommittedRouteRef.current = true;

      const timeoutId = setTimeout(() => {
        hasJustCommittedRouteRef.current = false;

        // A restore mark is spent by the first registration that follows it,
        // whichever route that is. Leaving an unmatched mark armed lets a
        // later ordinary navigation to that route restore a stale timestamp
        // over data the router just refetched.
        const restoreKey = historyRestoreKeyRef.current;
        historyRestoreKeyRef.current = null;

        if (restoreKey === routeKey) {
          const restoredAt = refreshedAtByRouteRef.current.get(routeKey);
          if (restoredAt !== undefined) {
            setLastRefreshedAt(restoredAt);
            return;
          }
        }

        markRefreshed(routeKey);
      }, 0);

      return () => {
        hasJustCommittedRouteRef.current = false;
        clearTimeout(timeoutId);
      };
    },
    [markRefreshed],
  );

  useEffect(() => {
    if (isPending || !isRefreshingRef.current) return;
    isRefreshingRef.current = false;
    markRefreshed(routeKeyRef.current);
  }, [isPending, markRefreshed]);

  useEffect(() => {
    if (lastRefreshedAt === null) return;
    return scheduleAdminRefresh(lastRefreshedAt, startRefresh);
  }, [lastRefreshedAt, startRefresh]);

  const refreshed =
    lastRefreshedAt === null ? null : formatRefreshedAt(lastRefreshedAt);

  return (
    <AdminRefreshContext.Provider
      value={{ isPending, refreshed, registerRoute, startRefresh }}
    >
      <Suspense fallback={null}>
        <AdminRefreshRouteTracker />
      </Suspense>
      {children}
    </AdminRefreshContext.Provider>
  );
}

function AdminRefreshRouteTracker(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useContext(AdminRefreshContext);
  const routeKey = getAdminRouteKey(pathname, searchParams.toString());

  if (!context) {
    throw new Error(
      "AdminRefreshRouteTracker must render inside AdminRefreshProvider",
    );
  }

  const { registerRoute } = context;

  useEffect(() => {
    return registerRoute(routeKey);
  }, [registerRoute, routeKey]);

  return null;
}
