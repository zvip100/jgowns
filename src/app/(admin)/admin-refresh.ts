/** How long an open admin page may keep showing the data it rendered with. */
export const ADMIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Route identity for the freshness deadline: every admin filter, search, date,
 * actor and page control is a query-string navigation, so the query belongs in
 * the key. Both sides go through URLSearchParams so a raw `location.search` and
 * a `useSearchParams().toString()` for the same URL compare equal.
 */
export function getAdminRouteKey(pathname: string, search: string): string {
  const query = new URLSearchParams(search).toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * How many route timestamps to keep. A session visits far fewer than this, but
 * a page left open for hours must not grow a map without bound.
 */
export const ADMIN_REFRESH_MEMORY_LIMIT = 50;

/** Records a route's refresh time, evicting the least recently recorded. */
export function rememberRefreshedAt(
  memory: Map<string, number>,
  routeKey: string,
  timestamp: number,
): void {
  memory.delete(routeKey);
  memory.set(routeKey, timestamp);

  while (memory.size > ADMIN_REFRESH_MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

const REFRESH_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const REFRESH_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

export type RefreshedAtLabel = {
  label: string;
  title: string;
  dateTime: string;
};

/**
 * "Last refreshed", not "last updated": the page knows when it fetched, not
 * when the database last changed.
 */
export function formatRefreshedAt(timestamp: number): RefreshedAtLabel {
  const date = new Date(timestamp);

  return {
    label: `Last refreshed at ${REFRESH_TIME_FORMAT.format(date)}`,
    title: REFRESH_DATE_TIME_FORMAT.format(date),
    dateTime: date.toISOString(),
  };
}

/**
 * Arms one deadline and returns its teardown. Browsers throttle timers in
 * background tabs, so the deadline only fires while the tab is visible and a
 * tab that returns overdue refreshes on `visibilitychange` instead; a latch
 * keeps the two paths to a single refresh per deadline, and the caller re-arms
 * from the new timestamp once that refresh lands.
 */
export function scheduleAdminRefresh(
  lastRefreshedAt: number,
  onDue: () => void,
): () => void {
  const deadline = lastRefreshedAt + ADMIN_REFRESH_INTERVAL_MS;
  let hasFired = false;

  function refreshIfVisible(): void {
    if (hasFired || document.visibilityState !== "visible") return;
    hasFired = true;
    onDue();
  }

  const timeoutId = setTimeout(
    refreshIfVisible,
    Math.max(0, deadline - Date.now()),
  );

  function handleVisibilityChange(): void {
    if (Date.now() < deadline) return;
    refreshIfVisible();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
