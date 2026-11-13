/** Longest the bar may stay on screen, so a navigation that never commits a new URL cannot strand it. */
export const NAVIGATION_PROGRESS_TIMEOUT_MS = 15_000;

export type NavigationProgressSnapshot = {
  /** Changes once per shown bar, so the segment remounts and sweeps from the left again. */
  id: number;
  isPending: boolean;
};

let snapshot: NavigationProgressSnapshot = { id: 0, isPending: false };
let committedKey: string | null = null;
let timeoutId: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setSnapshot(next: NavigationProgressSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Path plus re-serialized query, so both sides of a comparison encode alike. */
function getNavigationKey(pathname: string, search: string): string {
  return `${pathname}?${new URLSearchParams(search).toString()}`;
}

/** Marks a client-side navigation as pending. A navigation to the URL already on screen commits nothing, so it ends the bar instead. */
export function startNavigationProgress(url: string): void {
  const target = new URL(url, window.location.href);
  if (getNavigationKey(target.pathname, target.search) === committedKey) {
    stopNavigationProgress();
    return;
  }

  clearTimeout(timeoutId);
  timeoutId = setTimeout(stopNavigationProgress, NAVIGATION_PROGRESS_TIMEOUT_MS);
  if (snapshot.isPending) return;
  setSnapshot({ id: snapshot.id + 1, isPending: true });
}

export function stopNavigationProgress(): void {
  clearTimeout(timeoutId);
  timeoutId = undefined;
  if (!snapshot.isPending) return;
  setSnapshot({ id: snapshot.id, isPending: false });
}

/** Records the URL the router just committed, which is what ends a pending navigation. */
export function commitNavigationProgress(pathname: string, search: string): void {
  committedKey = getNavigationKey(pathname, search);
  stopNavigationProgress();
}

export function subscribeNavigationProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavigationProgress(): NavigationProgressSnapshot {
  return snapshot;
}
