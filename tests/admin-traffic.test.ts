import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import {
  TRAFFIC_DAYS,
  getTrafficDaily,
  getTrafficEngagement,
  getTrafficWeekly,
  trafficAsOf,
  trafficConfigured,
} from "@/lib/queries/admin/traffic";
import {
  formatAsOf,
  formatCount,
  formatDuration,
  formatPercent,
  oldestRefresh,
  rateHint,
  weekOverWeekHint,
} from "@/app/(admin)/admin/traffic/traffic-format";
import { formatDayLabel } from "@/lib/admin/list";

import type { ReactElement } from "react";
import type { TrafficResult, TrafficWeekly } from "@/lib/admin/types";

const API_KEY = "phx_test_key_never_logged";
const AS_OF = "2026-11-20";
const REFRESH = "2026-11-20T21:10:00.123456Z";

const WEEKLY_COLUMNS = [
  "period",
  "visitors",
  "pageviews",
  "sessions",
  "sell_clicks",
  "registrations",
  "drafts_started",
  "listings_submitted",
  "checkouts_started",
  "paid_listings",
  "listing_views",
  "contact_actions",
  "wishlist_adds",
];

const THIS_WEEK_ROW = ["this_week", 125, 2156, 243, 70, 15, 20, 10, 7, 5, 632, 9, 0];
const LAST_WEEK_ROW = ["last_week", 54, 370, 88, 5, 2, 1, 3, 1, 1, 123, 6, 0];

function envelope(
  columns: string[],
  results: unknown[][],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { columns, results, last_refresh: REFRESH, endpoint_version: 1, ...extra };
}

const fetchMock = vi.fn();
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

function respond(body: unknown, status = 200): void {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function loggedText(): string {
  return JSON.stringify(errorSpy.mock.calls);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", API_KEY);
  vi.stubEnv("POSTHOG_PROJECT_ID", "538569");
  fetchMock.mockReset();
  errorSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("trafficAsOf", () => {
  it("returns the New York date, not the UTC one, around UTC midnight", () => {
    expect(trafficAsOf(new Date("2026-11-21T03:30:00Z"))).toBe("2026-11-20");
    expect(trafficAsOf(new Date("2026-11-21T05:30:00Z"))).toBe("2026-11-21");
  });

  it("follows both DST transitions", () => {
    // EDT (UTC-4) on the spring-forward day, EST (UTC-5) after fall-back.
    expect(trafficAsOf(new Date("2026-03-09T03:30:00Z"))).toBe("2026-03-08");
    expect(trafficAsOf(new Date("2026-03-09T04:30:00Z"))).toBe("2026-03-09");
    expect(trafficAsOf(new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
    expect(trafficAsOf(new Date("2026-11-02T05:30:00Z"))).toBe("2026-11-02");
  });
});

describe("trafficConfigured", () => {
  it("needs both vars", () => {
    expect(trafficConfigured({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "1" })).toBe(true);
    expect(trafficConfigured({ POSTHOG_PERSONAL_API_KEY: "k" })).toBe(false);
    expect(trafficConfigured({ POSTHOG_PROJECT_ID: "1" })).toBe(false);
  });

  it("treats blank or whitespace values as unset", () => {
    expect(trafficConfigured({ POSTHOG_PERSONAL_API_KEY: "  ", POSTHOG_PROJECT_ID: "1" })).toBe(false);
    expect(trafficConfigured({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: " " })).toBe(false);
  });

  it("rejects a non-numeric project id instead of coercing it", () => {
    expect(trafficConfigured({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "538569abc" })).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("endpoint request", () => {
  it("POSTs the as-of variable to the saved endpoint with a Bearer key and a timeout", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW, LAST_WEEK_ROW]));

    await getTrafficWeekly(AS_OF);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://us.posthog.com/api/projects/538569/endpoints/admin_traffic_weekly/run",
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(String(init.body))).toEqual({
      variables: { as_of: AS_OF },
      refresh: "cache",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never calls PostHog with a malformed as-of date", async () => {
    const result = await getTrafficWeekly("11/20/2026");
    expect(result).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getTrafficWeekly", () => {
  it("maps both weeks and keeps PostHog's refresh time", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW, LAST_WEEK_ROW]));

    const result = await getTrafficWeekly(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.refreshedAt).toBe(REFRESH);
    expect(result.data.thisWeek).toMatchObject({ visitors: 125, pageviews: 2156, paid_listings: 5 });
    expect(result.data.lastWeek).toMatchObject({ visitors: 54, pageviews: 370, paid_listings: 1 });
  });

  it("reads a week with no row as zeros", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW]));

    const result = await getTrafficWeekly(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(Object.values(result.data.lastWeek).every((value) => value === 0)).toBe(true);
  });

  it("leaves freshness unknown when PostHog sends no last_refresh", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW], { last_refresh: undefined }));

    const result = await getTrafficWeekly(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.refreshedAt).toBeNull();
  });

  it.each([401, 403, 404, 429, 500])("is unavailable on HTTP %i and logs the status", async (status) => {
    respond({ detail: "nope" }, status);

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain(String(status));
  });

  it("is unavailable on a timeout and says so in the log", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain("timeout");
  });

  it("is unavailable when fetch itself rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain("network");
  });

  it("is unavailable on a body that is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("is unavailable on an unexpected envelope", async () => {
    respond({ rows: [] });

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain("envelope");
  });

  it("rejects a renamed column and logs the endpoint version", async () => {
    const renamed = WEEKLY_COLUMNS.map((column) => (column === "visitors" ? "users" : column));
    respond(envelope(renamed, [THIS_WEEK_ROW], { endpoint_version: 7 }));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain("columns");
    expect(loggedText()).toContain("7");
  });

  it("rejects reordered columns", async () => {
    const reordered = [...WEEKLY_COLUMNS];
    [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
    respond(envelope(reordered, [THIS_WEEK_ROW]));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("rejects a row narrower than its columns", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW.slice(0, -1)]));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(loggedText()).toContain("row width");
  });

  it("rejects a string where a count belongs instead of coercing it", async () => {
    const stringly = [...THIS_WEEK_ROW];
    stringly[1] = "125";
    respond(envelope(WEEKLY_COLUMNS, [stringly]));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("rejects bad values inside the cached fetch, logging the endpoint version", async () => {
    const stringly = [...THIS_WEEK_ROW];
    stringly[1] = "125";
    respond(envelope(WEEKLY_COLUMNS, [stringly], { endpoint_version: 4 }));

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    // One log line, from the cached function, carrying the reason and version.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe("[queries/admin/traffic] admin_traffic_weekly failed");
    expect(errorSpy.mock.calls[0][1]).toMatchObject({ reason: "rows", endpoint_version: 4 });
  });

  it("rejects negative and fractional counts", async () => {
    const negative = [...THIS_WEEK_ROW];
    negative[2] = -1;
    respond(envelope(WEEKLY_COLUMNS, [negative]));
    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });

    const fractional = [...THIS_WEEK_ROW];
    fractional[2] = 1.5;
    respond(envelope(WEEKLY_COLUMNS, [fractional]));
    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("rejects duplicate periods and too many rows", async () => {
    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW, THIS_WEEK_ROW]));
    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });

    respond(envelope(WEEKLY_COLUMNS, [THIS_WEEK_ROW, LAST_WEEK_ROW, LAST_WEEK_ROW]));
    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("never logs the API key", async () => {
    respond({}, 401);
    await getTrafficWeekly(AS_OF);
    respond(envelope(["nope"], [[1]]));
    await getTrafficWeekly(AS_OF);

    expect(errorSpy).toHaveBeenCalled();
    expect(loggedText()).not.toContain(API_KEY);
  });

  it("does not call PostHog when the vars are unset", async () => {
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");

    expect(await getTrafficWeekly(AS_OF)).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getTrafficDaily", () => {
  const DAILY_COLUMNS = ["day", "visitors", "pageviews"];

  it("zero-fills to 14 ascending days ending on as-of, only the last one partial", async () => {
    respond(
      envelope(DAILY_COLUMNS, [
        ["2026-11-08", 14, 78],
        ["2026-11-19", 65, 914],
        ["2026-11-20", 29, 347],
      ]),
    );

    const result = await getTrafficDaily(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const days = result.data;
    expect(days).toHaveLength(TRAFFIC_DAYS);
    expect(days[0].day).toBe("2026-11-07");
    expect(days.at(-1)).toEqual({ day: AS_OF, visitors: 29, pageviews: 347, isPartial: true });
    expect(days[0]).toEqual({ day: "2026-11-07", visitors: 0, pageviews: 0, isPartial: false });
    expect(days[1]).toMatchObject({ day: "2026-11-08", visitors: 14 });
    expect(days.filter((day) => day.isPartial)).toHaveLength(1);
    expect(days.map((day) => day.day)).toEqual([...days.map((day) => day.day)].sort());
  });

  it("crosses a month boundary without skipping a day", async () => {
    respond(envelope(DAILY_COLUMNS, []));

    const result = await getTrafficDaily("2026-12-03");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data[0].day).toBe("2026-11-20");
    expect(result.data.map((day) => day.day)).toContain("2026-11-30");
    expect(result.data.map((day) => day.day)).toContain("2026-12-01");
  });

  it("rejects a day outside the 14-day window", async () => {
    respond(envelope(DAILY_COLUMNS, [["2026-11-06", 1, 1]]));
    expect(await getTrafficDaily(AS_OF)).toEqual({ status: "unavailable" });

    respond(envelope(DAILY_COLUMNS, [["2026-11-21", 1, 1]]));
    expect(await getTrafficDaily(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("rejects a duplicate day and more than 14 rows", async () => {
    respond(envelope(DAILY_COLUMNS, [["2026-11-20", 1, 1], ["2026-11-20", 2, 2]]));
    expect(await getTrafficDaily(AS_OF)).toEqual({ status: "unavailable" });

    const tooMany = Array.from({ length: 15 }, (_, index) => [`2026-11-${String(index + 1).padStart(2, "0")}`, 1, 1]);
    respond(envelope(DAILY_COLUMNS, tooMany));
    expect(await getTrafficDaily(AS_OF)).toEqual({ status: "unavailable" });
  });

  it("rejects a malformed day", async () => {
    respond(envelope(DAILY_COLUMNS, [["Nov 20", 1, 1]]));
    expect(await getTrafficDaily(AS_OF)).toEqual({ status: "unavailable" });
  });
});

describe("getTrafficEngagement", () => {
  const ENGAGEMENT_COLUMNS = ["period", "sessions", "bounce_rate", "avg_session_seconds"];

  it("maps both weeks", async () => {
    respond(
      envelope(ENGAGEMENT_COLUMNS, [
        ["this_week", 243, 0.107, 537.8],
        ["last_week", 88, 0.273, 307.6],
      ]),
    );

    const result = await getTrafficEngagement(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.thisWeek).toEqual({ sessions: 243, bounce_rate: 0.107, avg_session_seconds: 537.8 });
    expect(result.data.lastWeek.sessions).toBe(88);
  });

  it("keeps null rates and reads a missing week as no sessions", async () => {
    respond(envelope(ENGAGEMENT_COLUMNS, [["this_week", 0, null, null]]));

    const result = await getTrafficEngagement(AS_OF);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.thisWeek).toEqual({ sessions: 0, bounce_rate: null, avg_session_seconds: null });
    expect(result.data.lastWeek).toEqual({ sessions: 0, bounce_rate: null, avg_session_seconds: null });
  });

  it("rejects a bounce rate above 1 (a percent where a fraction belongs)", async () => {
    respond(envelope(ENGAGEMENT_COLUMNS, [["this_week", 243, 27.3, 537.8]]));
    expect(await getTrafficEngagement(AS_OF)).toEqual({ status: "unavailable" });
  });
});

describe("traffic-format", () => {
  it("formats counts, percents and durations", () => {
    expect(formatCount(2156)).toBe("2,156");
    expect(formatPercent(0.107)).toBe("10.7%");
    expect(formatPercent(null)).toBe("–");
    expect(formatDuration(537.8)).toBe("8m 58s");
    expect(formatDuration(307.6)).toBe("5m 08s");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(null)).toBe("–");
  });

  it("labels bare days in calendar terms and the snapshot in New York time", () => {
    expect(formatDayLabel("2026-11-20")).toBe("Nov 20");
    expect(formatAsOf("2026-11-20T21:10:00Z")).toBe("As of Nov 20, 4:10 PM ET");
  });

  it("weekOverWeekHint gives a percent only when both weeks reach 10", () => {
    expect(weekOverWeekHint(125, 54)).toBe("Up 131% from 54");
    expect(weekOverWeekHint(40, 50)).toBe("Down 20% from 50");
    expect(weekOverWeekHint(50, 50)).toBe("Same as last week");
    expect(weekOverWeekHint(5, 1)).toBe("Last week 1");
    expect(weekOverWeekHint(70, 5)).toBe("Last week 5");
    expect(weekOverWeekHint(0, 0)).toBe("Last week 0");
    expect(weekOverWeekHint(2156, 370)).toBe("Up 483% from 370");
  });

  it("weekOverWeekHint handles missing weeks and custom formats", () => {
    expect(weekOverWeekHint(537.8, 307.6, formatDuration)).toBe("Up 75% from 5m 08s");
    expect(weekOverWeekHint(null, 307.6, formatDuration)).toBe("Last week 5m 08s");
    expect(weekOverWeekHint(100, null)).toBe("No data last week");
  });

  it("rateHint compares in points", () => {
    expect(rateHint(0.107, 0.273)).toBe("Down 16.6 pts from 27.3%");
    expect(rateHint(0.3, 0.2)).toBe("Up 10.0 pts from 20.0%");
    expect(rateHint(0.2, 0.2)).toBe("Same as last week");
    expect(rateHint(null, 0.2)).toBe("Last week 20.0%");
    expect(rateHint(0.2, null)).toBe("No data last week");
  });

  it("oldestRefresh picks the oldest loaded block and ignores failures", () => {
    const ok = (refreshedAt: string | null): TrafficResult<null> => ({ status: "ok", data: null, refreshedAt });
    expect(
      oldestRefresh([ok("2026-11-20T21:10:00Z"), { status: "unavailable" }, ok("2026-11-20T21:02:00Z")]),
    ).toBe("2026-11-20T21:02:00Z");
    expect(oldestRefresh([{ status: "unavailable" }])).toBeNull();
    expect(oldestRefresh([])).toBeNull();
    expect(oldestRefresh([ok("2026-11-20T21:10:00Z"), ok(null)])).toBeNull();
  });
});
