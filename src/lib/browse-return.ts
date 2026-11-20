export const BROWSE_RETURN_STORAGE_KEY = "jgowns:browse-return";

/** Where the list was scrolled to when a gown was opened from it. */
export type BrowseReturnPosition = {
  detailPath: string;
  search: string;
  scrollY: number;
};

type PendingBrowseRestore = {
  href: string;
  scrollY: number;
  /** Set for a history-back, where a list the router kept alive is restored by the browser itself. */
  isFreshOnly: boolean;
};

type NavigationLike = {
  readonly currentEntry: NavigationHistoryEntry | null;
  entries(): NavigationHistoryEntry[];
};

let pendingRestore: PendingBrowseRestore | null = null;

/** Saves the list position when a gown is opened from the list, and forgets it when one is opened from anywhere else. Runs inside the click, before the router moves. */
export function trackBrowseReturn(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  if (navigationType === "traverse") return;
  pendingRestore = null;
  if (navigationType !== "push") return;

  const target = new URL(url, window.location.href);
  if (!target.pathname.startsWith("/browse/")) return;

  try {
    // Removed first: a gown opened from elsewhere has no list position, and a failed write must not leave an older one.
    window.sessionStorage.removeItem(BROWSE_RETURN_STORAGE_KEY);
    if (window.location.pathname !== "/browse") return;

    const position: BrowseReturnPosition = {
      detailPath: target.pathname,
      search: window.location.search,
      scrollY: window.scrollY,
    };
    window.sessionStorage.setItem(BROWSE_RETURN_STORAGE_KEY, JSON.stringify(position));
  } catch (error) {
    console.warn("[browse-return] Could not save the list position:", error);
  }
}

export function readBrowseReturnPosition(): BrowseReturnPosition | null {
  try {
    const raw = window.sessionStorage.getItem(BROWSE_RETURN_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!("detailPath" in parsed) || !("search" in parsed) || !("scrollY" in parsed)) {
      return null;
    }
    const { detailPath, search, scrollY } = parsed;
    if (typeof detailPath !== "string" || typeof search !== "string") return null;
    if (typeof scrollY !== "number" || !Number.isFinite(scrollY) || scrollY < 0) {
      return null;
    }
    return { detailPath, search, scrollY };
  } catch (error) {
    console.warn("[browse-return] Could not read the list position:", error);
    return null;
  }
}

/** URL of the history entry directly behind this one, or null when the browser cannot tell. */
export function getPreviousEntryUrl(): URL | null {
  // Cast: TypeScript 5.9 has no `window.navigation` and newer versions type it as always present, so only an intersection compiles under both.
  const { navigation } = window as Window & { navigation?: NavigationLike };
  const index = navigation?.currentEntry?.index ?? 0;
  const url = navigation?.entries()[index - 1]?.url;
  return url ? new URL(url) : null;
}

export function setPendingBrowseRestore(pending: PendingBrowseRestore): void {
  pendingRestore = pending;
}

/** Hands the pending position to the list that just mounted, once. */
export function takePendingBrowseRestore(href: string, isFresh: boolean): number | null {
  const pending = pendingRestore;
  pendingRestore = null;
  if (!pending || pending.href !== href) return null;
  if (pending.isFreshOnly && !isFresh) return null;
  return pending.scrollY;
}
