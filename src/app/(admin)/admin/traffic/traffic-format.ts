import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { APP_TIME_ZONE } from "@/lib/site";

import type { TrafficResult } from "@/lib/admin/types";

/** Below this on either side a percent change is noise, so the raw figure is shown. */
const PERCENT_CHANGE_MINIMUM = 10;

const AS_OF_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const COUNT_FORMAT = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

/** A 0..1 fraction as a one-decimal percent, e.g. 0.107 -> "10.7%". */
export function formatPercent(fraction: number | null): string {
  if (fraction === null) return ADMIN_EMPTY_VALUE;
  return `${(fraction * 100).toFixed(1)}%`;
}

/** Whole seconds as "8m 58s", or "42s" under a minute. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return ADMIN_EMPTY_VALUE;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

/** "As of Nov 20, 4:10 PM ET" for an ISO timestamp. */
export function formatAsOf(iso: string): string {
  return `As of ${AS_OF_FORMAT.format(new Date(iso))} ET`;
}

/**
 * The week-over-week line under a stat. A percent only when both weeks are big
 * enough to mean something (the posthog-metrics rule), otherwise last week's
 * raw figure. A missing week (no sessions to average) says so.
 */
export function weekOverWeekHint(
  current: number | null,
  previous: number | null,
  format: (value: number) => string = formatCount,
): string {
  if (previous === null) return "No data last week";
  if (
    current === null ||
    current < PERCENT_CHANGE_MINIMUM ||
    previous < PERCENT_CHANGE_MINIMUM
  ) {
    return `Last week ${format(previous)}`;
  }

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "Same as last week";
  return `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% from ${format(previous)}`;
}

/** A rate compares in percentage points, e.g. "Down 16.6 pts from 27.3%". */
export function rateHint(current: number | null, previous: number | null): string {
  if (previous === null) return "No data last week";
  if (current === null) return `Last week ${formatPercent(previous)}`;

  const points = Math.round((current - previous) * 1000) / 10;
  if (points === 0) return "Same as last week";
  return `${points > 0 ? "Up" : "Down"} ${Math.abs(points).toFixed(1)} pts from ${formatPercent(previous)}`;
}

/**
 * The snapshot time the page can honestly claim: the oldest refresh among the
 * blocks that loaded. Null when none did, or when any loaded block's refresh is unknown.
 */
export function oldestRefresh(results: TrafficResult<unknown>[]): string | null {
  const times = results.flatMap((result) =>
    result.status === "ok" ? [result.refreshedAt] : [],
  );
  const known = times.filter((time) => time !== null);
  if (known.length === 0 || known.length < times.length) return null;
  return known.reduce((oldest, time) =>
    Date.parse(time) < Date.parse(oldest) ? time : oldest,
  );
}
