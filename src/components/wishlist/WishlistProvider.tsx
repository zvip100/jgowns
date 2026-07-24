'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  addToWishlist,
  mergeWishlist,
  removeFromWishlist,
  type WishlistActionResult,
} from '@/lib/actions/wishlist';
import { toast } from '@/lib/toast';
import { WISHLIST_STORAGE_KEY, WISHLIST_STORAGE_VERSION } from '@/lib/types';
import {
  addWishlistItem,
  applyWishlistStatusRefresh,
  parseWishlistStorage,
  planWishlistReconcile,
  removeWishlistItem,
  serializeWishlistStorage,
  sortWishlistItems,
} from '@/lib/wishlist-storage';

import type {
  WishlistItem,
  WishlistItemStatus,
  WishlistSnapshot,
  WishlistStatusEntry,
  WishlistStatusResponse,
} from '@/lib/types';

const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

type ServerPayload = {
  isAuthenticated: boolean;
  userId: string | null;
  items: WishlistItem[] | null;
};

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  isHydrated: boolean;
  isAuthenticated: boolean;
  isSaved: (listingId: string) => boolean;
  toggleItem: (
    listingId: string,
    snapshot: WishlistSnapshot,
    status: WishlistItemStatus,
  ) => void;
  removeItem: (listingId: string) => void;
  syncFromServer: (payload: ServerPayload) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

type WishlistProviderProps = {
  children: ReactNode;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}

function readStored(): {
  items: WishlistItem[];
  ownerId: string | null;
} {
  try {
    const parsed = parseWishlistStorage(
      window.localStorage.getItem(WISHLIST_STORAGE_KEY),
    );
    return {
      items: sortWishlistItems(parsed.items),
      ownerId: parsed.ownerId,
    };
  } catch (error) {
    console.warn('[wishlist] Failed to read localStorage', error);
    return { items: [], ownerId: null };
  }
}

function persist(items: WishlistItem[], ownerId: string | null): void {
  try {
    window.localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      serializeWishlistStorage({
        version: WISHLIST_STORAGE_VERSION,
        ownerId,
        items,
      }),
    );
  } catch (error) {
    console.warn(
      '[wishlist] Failed to persist wishlist (quota or private mode); staying in-memory for this session',
      error,
    );
  }
}

export function WishlistProvider({ children }: WishlistProviderProps) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [serverPayload, setServerPayload] = useState<ServerPayload | null>(null);

  const itemsRef = useRef<WishlistItem[]>(items);
  const ownerIdRef = useRef<string | null>(null);
  const authedRef = useRef(false);
  const lastSyncedAuthRef = useRef<boolean | null>(null);
  const lastRefreshedAtRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // A failed background write is surfaced, never reverted (§ optimistic writes);
  // the item stays locally and self-heals on the next sign-in merge. When the
  // failure follows an optimistic success toast, pass its id so this notice
  // replaces it in place rather than stacking a second toast.
  const flashWriteError = useCallback((replaceId?: string | number) => {
    toast.error('Not synced', {
      id: replaceId,
      description:
        'This change is saved on this device but did not reach your account.',
    });
  }, []);

  // Read localStorage only after mount; an initializer would forfeit static
  // prerendering and cause a hydration mismatch (browser-only API).
  useEffect(() => {
    const stored = readStored();
    ownerIdRef.current = stored.ownerId;
    setItems(stored.items);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    persist(items, ownerIdRef.current);
  }, [items, isHydrated]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== WISHLIST_STORAGE_KEY) return;
      const parsed = parseWishlistStorage(event.newValue);
      ownerIdRef.current = parsed.ownerId;
      setItems(sortWishlistItems(parsed.items));
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto-reopen the drawer after a sign-in that began in the drawer (§5.3). Read
  // from window (not useSearchParams) so this layout-root client component never
  // forces the whole (main) tree into client-side rendering.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('wishlist') !== 'open') return;
    setIsOpen(true);
    params.delete('wishlist');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : ''),
    );
  }, []);

  const syncFromServer = useCallback((payload: ServerPayload) => {
    setServerPayload(payload);
  }, []);

  // Reconcile local storage with the server payload after both are available,
  // and again whenever the auth state flips (sign-in/out via soft navigation, so
  // the provider stays mounted and never remounts). Re-running only on an auth
  // change avoids redundant merges on plain page-to-page navigation. Ordering
  // matters: local hydration must land first so a merge sees the local items.
  useEffect(() => {
    if (!isHydrated || !serverPayload) return;
    if (lastSyncedAuthRef.current === serverPayload.isAuthenticated) return;
    lastSyncedAuthRef.current = serverPayload.isAuthenticated;

    setIsAuthenticated(serverPayload.isAuthenticated);
    authedRef.current = serverPayload.isAuthenticated;

    const plan = planWishlistReconcile({
      isAuthenticated: serverPayload.isAuthenticated,
      currentUserId: serverPayload.userId,
      ownerId: ownerIdRef.current,
      localItems: itemsRef.current,
      serverItems: serverPayload.items,
    });

    // Signed out (or server unavailable): keep the mirror exactly as-is. Never
    // clear it, and never touch ownerId (edits made while signed out inherit it).
    if (plan.type === 'keep-local') return;

    const userId = serverPayload.userId;

    if (plan.type === 'use-server') {
      // Adopt the account list: either nothing local to merge, or the cache
      // mirrored a different account and is discarded wholesale.
      ownerIdRef.current = userId;
      setItems(sortWishlistItems(plan.items));
      return;
    }

    // plan.type === 'merge' — fold local items into this user's account, then
    // adopt the canonical list. This also self-heals any earlier failed writes,
    // since a locally-cached item missing from the DB is simply upserted now.
    mergeWishlist(plan.payload)
      .then((result) => {
        if (result.success) {
          ownerIdRef.current = userId;
          setItems(sortWishlistItems(result.items));
        } else {
          // Keep local items; the next sign-in retries the merge.
          console.error('[wishlist] Merge on sign-in failed', result.error);
          flashWriteError();
        }
      })
      .catch((err) => {
        console.error('[wishlist] Merge on sign-in failed', err);
        flashWriteError();
      });
  }, [isHydrated, serverPayload, flashWriteError]);

  const isSaved = useCallback(
    (listingId: string) => items.some((item) => item.listingId === listingId),
    [items],
  );

  // Mirror an optimistic local change to the account in the background. The local
  // change already landed and is never reverted on failure; a failed write is
  // surfaced via the toast (and self-heals on the next sign-in merge).
  const mirrorWrite = useCallback(
    (
      label: string,
      run: () => Promise<WishlistActionResult>,
      optimisticToastId?: string | number,
    ): void => {
      run()
        .then((result) => {
          if (!result.success) {
            console.error(`[wishlist] ${label} failed`, result.error);
            flashWriteError(optimisticToastId);
          }
        })
        .catch((err) => {
          console.error(`[wishlist] ${label} failed`, err);
          flashWriteError(optimisticToastId);
        });
    },
    [flashWriteError],
  );

  const toggleItem = useCallback(
    (
      listingId: string,
      snapshot: WishlistSnapshot,
      status: WishlistItemStatus,
    ): void => {
      const existing = itemsRef.current.find(
        (item) => item.listingId === listingId,
      );

      if (existing) {
        setItems((current) => removeWishlistItem(current, listingId));
        const toastId = toast.success('Removed from wishlist');
        // Mirror the change to the account in the background when signed in; a
        // failed write replaces the success toast above via its id.
        if (authedRef.current) {
          mirrorWrite('Remove', () => removeFromWishlist(listingId), toastId);
        }
        return;
      }

      const result = addWishlistItem(itemsRef.current, {
        listingId,
        addedAt: new Date().toISOString(),
        status,
        snapshot,
      });

      if (result.error) {
        // Add rejected (wishlist full) — surface the reason rather than the
        // silent no-op the local state now is.
        toast.error(result.error);
        return;
      }

      setItems(sortWishlistItems(result.items));
      const toastId = toast.success('Saved to wishlist');
      if (authedRef.current) {
        mirrorWrite('Add', () => addToWishlist(listingId, snapshot), toastId);
      }
    },
    [mirrorWrite],
  );

  const removeItem = useCallback(
    (listingId: string) => {
      const removed = itemsRef.current.find(
        (item) => item.listingId === listingId,
      );
      setItems((current) => removeWishlistItem(current, listingId));

      if (removed) {
        const toastId = toast.success('Removed from wishlist');
        if (authedRef.current) {
          mirrorWrite('Remove', () => removeFromWishlist(listingId), toastId);
        }
      }
    },
    [mirrorWrite],
  );

  const refreshStatus = useCallback(() => {
    const now = Date.now();
    if (
      lastRefreshedAtRef.current !== null &&
      now - lastRefreshedAtRef.current < REFRESH_THROTTLE_MS
    ) {
      return;
    }
    const ids = itemsRef.current.map((item) => item.listingId);
    if (ids.length === 0) return;

    lastRefreshedAtRef.current = now;

    // Scope the response to exactly the ids requested, so a response that
    // resolves after the item list changed (e.g. a user switch swapped in a
    // different account's items) can't wrongly mark the new items unavailable.
    const requestedIds = new Set(ids);
    const params = new URLSearchParams({ ids: ids.join(',') });
    fetch(`/api/wishlist/status?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json() as Promise<WishlistStatusResponse>;
      })
      .then((data) => {
        const statusById = new Map<string, WishlistStatusEntry>(
          data.items.map((entry) => [entry.id, entry]),
        );
        setItems((current) =>
          applyWishlistStatusRefresh(current, statusById, requestedIds),
        );
      })
      .catch((error) => {
        console.error('[wishlist] Failed to refresh status', error);
      });
  }, []);

  useEffect(() => {
    if (isOpen) refreshStatus();
  }, [isOpen, refreshStatus]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  return (
    <WishlistContext.Provider
      value={{
        items,
        count: items.length,
        isHydrated,
        isAuthenticated,
        isSaved,
        toggleItem,
        removeItem,
        syncFromServer,
        isOpen,
        open,
        close,
        toggle,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}
