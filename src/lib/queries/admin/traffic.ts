import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { APP_TIME_ZONE, POSTHOG_UI_HOST } from "@/lib/site";

import type {
  TrafficDay,
  TrafficEngagement,
  TrafficEngagementWeek,
  TrafficResult,
  TrafficWeekCounts,
  TrafficWeekly,
} from "@/lib/admin/types";
import type { EnvRecord } from "@/lib/env";

/** Days charted on /admin/traffic, ending on the as-of day. */
export const TRAFFIC_DAYS = 14;

const REQUEST_TIMEOUT_MS = 10_000;
const LOG_SCOPE = "[queries/admin/traffic]";

const PROJECT_ID_PATTERN = /^\d+$/;
const ISO_DATE = z.iso.date();
const COUNT = z.number().int().nonnegative();
const PERIOD = z.enum(["this_week", "last_week"]);

type Period = z.infer<typeof PERIOD>;

const weeklyRowSchema = z.object({
  period: PERIOD,
  visitors: COUNT,
  pageviews: COUNT,
  sessions: COUNT,
  sell_clicks: COUNT,
  registrations: COUNT,
  drafts_started: COUNT,
  listings_submitted: COUNT,
  checkouts_started: COUNT,
  paid_listings: COUNT,
  listing_views: COUNT,
  contact_actions: COUNT,
  wishlist_adds: COUNT,
});

const dailyRowSchema = z.object({
  day: ISO_DATE,
  visitors: COUNT,
  pageviews: COUNT,
});

const engagementRowSchema = z.object({
  period: PERIOD,
  sessions: COUNT,
  bounce_rate: z.number().min(0).max(1).nullable(),
  avg_session_seconds: z.number().nonnegative().nullable(),
});

/** Each endpoint's columns, in order, taken from its row schema so the two cannot drift. */
const ENDPOINT_COLUMNS = {
  admin_traffic_weekly: weeklyRowSchema.keyof().options,
  admin_traffic_daily: dailyRowSchema.keyof().options,
  admin_traffic_engagement: engagementRowSchema.keyof().options,
};

type TrafficEndpoint = keyof typeof ENDPOINT_COLUMNS;

type RowsByEndpoint = {
  admin_traffic_weekly: z.infer<typeof weeklyRowSchema>[];
  admin_traffic_daily: z.infer<typeof dailyRowSchema>[];
  admin_traffic_engagement: z.infer<typeof engagementRowSchema>[];
};

type EndpointPayload<N extends TrafficEndpoint> = {
  rows: RowsByEndpoint[N];
  refreshedAt: string | null;
};

type TrafficConfig = { apiKey: string; projectId: string };

const envelopeSchema = z.object({
  columns: z.array(z.string()),
  results: z.array(z.array(z.unknown())),
  last_refresh: z.iso.datetime({ offset: true }).optional(),
  endpoint_version: z.number().int().optional(),
});

const AS_OF_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's New York calendar date (yyyy-mm-dd), the `as_of` every endpoint takes. */
export function trafficAsOf(now: Date): string {
  return AS_OF_FORMAT.format(now);
}

/** Shifts a bare yyyy-mm-dd by whole days, in calendar terms (no time zone). */
function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Value checks plus set rules: a row cap and unique keys. */
function parseRows<T>(
  schema: z.ZodType<T>,
  rows: Record<string, unknown>[],
  maxRows: number,
  keyOf: (row: T) => string,
): T[] {
  if (rows.length > maxRows) {
    throw new Error(`expected at most ${maxRows} rows, got ${rows.length}`);
  }

  const parsed = z.array(schema).parse(rows);
  if (new Set(parsed.map(keyOf)).size !== parsed.length) {
    throw new Error("duplicate row keys");
  }

  return parsed;
}

/** Runs inside the cached fetch, so a row set that fails is retried, never stored. */
const ROW_VALIDATORS: {
  [N in TrafficEndpoint]: (
    rows: Record<string, unknown>[],
    asOf: string,
  ) => RowsByEndpoint[N];
} = {
  admin_traffic_weekly: (rows) =>
    parseRows(weeklyRowSchema, rows, 2, (row) => row.period),
  admin_traffic_daily: (rows, asOf) => {
    const parsed = parseRows(dailyRowSchema, rows, TRAFFIC_DAYS, (row) => row.day);
    const firstDay = shiftDate(asOf, -(TRAFFIC_DAYS - 1));
    const outside = parsed.find((row) => row.day < firstDay || row.day > asOf);
    if (outside) throw new Error(`day ${outside.day} is outside the window`);
    return parsed;
  },
  admin_traffic_engagement: (rows) =>
    parseRows(engagementRowSchema, rows, 2, (row) => row.period),
};

function readTrafficConfig(env: EnvRecord = process.env): TrafficConfig | null {
  const apiKey = (env.POSTHOG_PERSONAL_API_KEY ?? "").trim();
  const projectId = (env.POSTHOG_PROJECT_ID ?? "").trim();
  if (!apiKey || !projectId) return null;

  if (!PROJECT_ID_PATTERN.test(projectId)) {
    console.error(`${LOG_SCOPE} POSTHOG_PROJECT_ID must be a numeric project id`);
    return null;
  }

  return { apiKey, projectId };
}

/** Both server-only vars present and usable. Unset means "not connected", never a failed deploy. */
export function trafficConfigured(env: EnvRecord = process.env): boolean {
  return readTrafficConfig(env) !== null;
}

function logEndpointFailure(
  name: TrafficEndpoint,
  details: Record<string, unknown>,
): void {
  console.error(`${LOG_SCOPE} ${name} failed`, details);
}

/**
 * One saved endpoint, cached per project, endpoint and New York day (the key is
 * read inside, so the secret stays out of the cache key). Every failure is
 * logged here and thrown, never returned: errors are obfuscated across the
 * cache boundary, and an errored entry is not stored, so the next request retries.
 */
async function runTrafficEndpoint<N extends TrafficEndpoint>(
  name: N,
  asOf: string,
  projectId: string,
): Promise<EndpointPayload<N>> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("posthog-traffic", `posthog-traffic:${name}`);

  const config = readTrafficConfig();
  if (!config) throw new Error("Traffic is not configured");

  const url = `${POSTHOG_UI_HOST}/api/projects/${projectId}/endpoints/${name}/run`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ variables: { as_of: asOf }, refresh: "cache" }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    logEndpointFailure(name, { reason: isTimeout ? "timeout" : "network" });
    throw new Error(`PostHog endpoint ${name} unreachable`);
  }

  if (!response.ok) {
    logEndpointFailure(name, { reason: "http", status: response.status });
    throw new Error(`PostHog endpoint ${name} returned ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    logEndpointFailure(name, { reason: "body" });
    throw new Error(`PostHog endpoint ${name} returned invalid JSON`);
  }

  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) {
    logEndpointFailure(name, { reason: "envelope" });
    throw new Error(`PostHog endpoint ${name} returned an unexpected envelope`);
  }

  const { columns, results, last_refresh, endpoint_version } = envelope.data;
  const expected: readonly string[] = ENDPOINT_COLUMNS[name];
  const isSameColumns =
    columns.length === expected.length &&
    columns.every((column, index) => column === expected[index]);
  const isRectangular = results.every((row) => row.length === expected.length);

  if (!isSameColumns || !isRectangular) {
    logEndpointFailure(name, {
      reason: isSameColumns ? "row width" : "columns",
      endpoint_version,
      columns,
    });
    throw new Error(`PostHog endpoint ${name} broke its column contract`);
  }

  const zipped = results.map((row) =>
    Object.fromEntries(expected.map((column, index) => [column, row[index]])),
  );

  let rows: RowsByEndpoint[N];
  try {
    rows = ROW_VALIDATORS[name](zipped, asOf);
  } catch (error) {
    logEndpointFailure(name, {
      reason: "rows",
      endpoint_version,
      message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    });
    throw new Error(`PostHog endpoint ${name} returned rows outside the contract`);
  }

  return { rows, refreshedAt: last_refresh ?? null };
}

async function loadTraffic<N extends TrafficEndpoint, T>(
  name: N,
  asOf: string,
  shape: (rows: RowsByEndpoint[N]) => T,
): Promise<TrafficResult<T>> {
  if (!ISO_DATE.safeParse(asOf).success) {
    console.error(`${LOG_SCOPE} ${name} called with an invalid as-of date`);
    return { status: "unavailable" };
  }

  const config = readTrafficConfig();
  if (!config) return { status: "unavailable" };

  try {
    const payload = await runTrafficEndpoint(name, asOf, config.projectId);
    return { status: "ok", data: shape(payload.rows), refreshedAt: payload.refreshedAt };
  } catch {
    // Already logged inside the cached function, with its details.
    return { status: "unavailable" };
  }
}

/** One week's row without its period key, or null when the week had no activity. */
function weekRow<R extends { period: Period }>(
  rows: R[],
  period: Period,
): Omit<R, "period"> | null {
  const row = rows.find((candidate) => candidate.period === period);
  if (!row) return null;
  const { period: _period, ...values } = row;
  return values;
}

const EMPTY_WEEK: TrafficWeekCounts = {
  visitors: 0,
  pageviews: 0,
  sessions: 0,
  sell_clicks: 0,
  registrations: 0,
  drafts_started: 0,
  listings_submitted: 0,
  checkouts_started: 0,
  paid_listings: 0,
  listing_views: 0,
  contact_actions: 0,
  wishlist_adds: 0,
};

const EMPTY_ENGAGEMENT: TrafficEngagementWeek = {
  sessions: 0,
  bounce_rate: null,
  avg_session_seconds: null,
};

/** This week vs last week counts. A week with no activity has no row and reads as zeros. */
export async function getTrafficWeekly(
  asOf: string,
): Promise<TrafficResult<TrafficWeekly>> {
  return loadTraffic("admin_traffic_weekly", asOf, (rows) => ({
    thisWeek: weekRow(rows, "this_week") ?? EMPTY_WEEK,
    lastWeek: weekRow(rows, "last_week") ?? EMPTY_WEEK,
  }));
}

/** Fourteen consecutive days ending on `asOf`, zero-filled, the last one marked partial. */
export async function getTrafficDaily(
  asOf: string,
): Promise<TrafficResult<TrafficDay[]>> {
  return loadTraffic("admin_traffic_daily", asOf, (rows) => {
    const byDay = new Map(rows.map((row) => [row.day, row]));
    const firstDay = shiftDate(asOf, -(TRAFFIC_DAYS - 1));
    return Array.from({ length: TRAFFIC_DAYS }, (_, index) => {
      const day = shiftDate(firstDay, index);
      const row = byDay.get(day);
      return {
        day,
        visitors: row?.visitors ?? 0,
        pageviews: row?.pageviews ?? 0,
        isPartial: day === asOf,
      };
    });
  });
}

/** Bounce rate and session length by session start week, per PostHog's web analytics definitions. */
export async function getTrafficEngagement(
  asOf: string,
): Promise<TrafficResult<TrafficEngagement>> {
  return loadTraffic("admin_traffic_engagement", asOf, (rows) => ({
    thisWeek: weekRow(rows, "this_week") ?? EMPTY_ENGAGEMENT,
    lastWeek: weekRow(rows, "last_week") ?? EMPTY_ENGAGEMENT,
  }));
}
