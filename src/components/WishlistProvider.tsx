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

import { WISHLIST_STORAGE_KEY, WISHLIST_STORAGE_VERSION } from '@/lib/types';
import {
  addWishlistItem,
  applyWishlistStatusRefresh,
  parseWishlistStorage,
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

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  isHydrated: boolean;
  isSaved: (listingId: string) => boolean;
  toggleItem: (
    listingId: string,
    snapshot: WishlistSnapshot,
    status: WishlistItemStatus,
  ) => string | null;
  removeItem: (listingId: string) => void;
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

function readStoredItems(): WishlistItem[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    return sortWishlistItems(parseWishlistStorage(raw).items);
  } catch (error) {
    console.warn('[wishlist] Failed to read localStorage', error);
    return [];
  }
}

function persistItems(items: WishlistItem[]): void {
  try {
    window.localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      serializeWishlistStorage({ version: WISHLIST_STORAGE_VERSION, items }),
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
  const [isOpen, setIsOpen] = useState(false);

  const itemsRef = useRef<WishlistItem[]>(items);
  const lastRefreshedAtRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Read localStorage only after mount; an initializer would forfeit static
  // prerendering and cause a hydration mismatch (browser-only API).
  useEffect(() => {
    setItems(readStoredItems());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    persistItems(items);
  }, [items, isHydrated]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== WISHLIST_STORAGE_KEY) return;
      setItems(sortWishlistItems(parseWishlistStorage(event.newValue).items));
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isSaved = useCallback(
    (listingId: string) => items.some((item) => item.listingId === listingId),
    [items],
  );

  const toggleItem = useCallback(
    (
      listingId: string,
      snapshot: WishlistSnapshot,
      status: WishlistItemStatus,
    ): string | null => {
      let error: string | null = null;
      setItems((current) => {
        if (current.some((item) => item.listingId === listingId)) {
          return removeWishlistItem(current, listingId);
        }
        const result = addWishlistItem(current, {
          listingId,
          addedAt: new Date().toISOString(),
          status,
          snapshot,
        });
        error = result.error;
        return sortWishlistItems(result.items);
      });
      return error;
    },
    [],
  );

  const removeItem = useCallback((listingId: string) => {
    setItems((current) => removeWishlistItem(current, listingId));
  }, []);

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
        setItems((current) => applyWishlistStatusRefresh(current, statusById));
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
        isSaved,
        toggleItem,
        removeItem,
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
