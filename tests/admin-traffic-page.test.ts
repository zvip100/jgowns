import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
  trafficConfigured: vi.fn(),
  trafficAsOf: vi.fn(),
  getTrafficWeekly: vi.fn(),
  getTrafficDaily: vi.fn(),
  getTrafficEngagement: vi.fn(),
}));

vi.mock("@/lib/queries/admin/traffic", () => queries);
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/traffic" }));
vi.mock("@/app/(admin)/AdminRefreshControl", () => ({
  AdminRefreshControl: () => "Admin refresh control",
}));
// The real chart is rendered through vi.importActual below; the blocks get a
// stub that prints the points they forward, so the mapping is assertable.
vi.mock("@/app/(admin)/admin/traffic/TrafficChart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/(admin)/admin/traffic/TrafficChart")>()),
  TrafficChart: ({ points }: { points: unknown }) => `points:${JSON.stringify(points)}`,
}));

import AdminTrafficPage from "@/app/(admin)/admin/traffic/page";
import { TrafficReport } from "@/app/(admin)/admin/traffic/TrafficReport";
import { toTrafficChartRows } from "@/app/(admin)/admin/traffic/TrafficChart";
import {
  TRAFFIC_COUNT_BLOCKS,
  TrafficAsOf,
  TrafficAsOfSkeleton,
  TrafficChartBlock,
  TrafficChartSkeleton,
  TrafficClusterSkeleton,
  TrafficCountBlock,
  TrafficCountSkeleton,
  TrafficEngagementBlock,
  TrafficEngagementSkeleton,
  TrafficReportSkeleton,
  TrafficUnavailable,
} from "@/app/(admin)/admin/traffic/traffic-blocks";
import { AdminChartPanel } from "@/app/(admin)/AdminChartPanel";
import { AdminNav } from "@/app/(admin)/AdminNav";
import { MetricsCharts } from "@/app/(admin)/admin/metrics/MetricsCharts";
import { statClusterCellsClass } from "@/app/(admin)/StatCluster";
import { TRAFFIC_BLOCK_SPAN } from "@/lib/styles";

import type { ReactNode } from "react";
import type {
  TrafficDay,
  TrafficEngagement,
  TrafficResult,
  TrafficWeekCounts,
  TrafficWeekly,
} from "@/lib/admin/types";

const REFRESH = "2026-11-20T21:10:00Z";
const UNAVAILABLE = { status: "unavailable" } as const;

function week(overrides: Partial<TrafficWeekCounts>): TrafficWeekCounts {
  return {
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
    ...overrides,
  };
}

const WEEKLY: TrafficResult<TrafficWeekly> = {
  status: "ok",
  refreshedAt: REFRESH,
  data: {
    thisWeek: week({ visitors: 125, pageviews: 2156, sessions: 243, paid_listings: 5, sell_clicks: 70, listing_views: 632, contact_actions: 9 }),
    lastWeek: week({ visitors: 54, pageviews: 370, sessions: 88, paid_listings: 1, sell_clicks: 5, listing_views: 123, contact_actions: 6 }),
  },
};

const ENGAGEMENT: TrafficResult<TrafficEngagement> = {
  status: "ok",
  refreshedAt: REFRESH,
  data: {
    thisWeek: { sessions: 243, bounce_rate: 0.107, avg_session_seconds: 537.8 },
    lastWeek: { sessions: 88, bounce_rate: 0.273, avg_session_seconds: 307.6 },
  },
};

const DAILY: TrafficResult<TrafficDay[]> = {
  status: "ok",
  refreshedAt: REFRESH,
  data: [
    { day: "2026-11-19", visitors: 65, pageviews: 914, isPartial: false },
    { day: "2026-11-20", visitors: 29, pageviews: 347, isPartial: true },
  ],
};

/** Async Server Components cannot be resolved by renderToStaticMarkup, so await the element first. */
async function renderAsync(element: Promise<ReactNode>): Promise<string> {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, await element));
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.trafficConfigured.mockReturnValue(true);
  queries.trafficAsOf.mockReturnValue("2026-11-20");
  queries.getTrafficWeekly.mockResolvedValue(WEEKLY);
  queries.getTrafficDaily.mockResolvedValue(DAILY);
  queries.getTrafficEngagement.mockResolvedValue(ENGAGEMENT);
});

describe("TrafficCountBlock", () => {
  const weekly = Promise.resolve(WEEKLY);

  it("headline shows this week's counts with week-over-week hints", async () => {
    const html = await renderAsync(TrafficCountBlock({ weekly, ...TRAFFIC_COUNT_BLOCKS.headline }));
    expect(html).toContain("This week");
    expect(html).toContain("2,156");
    expect(html).toContain("Up 131% from 54");
    expect(html).toContain("Paid listings");
    expect(html).toContain("Last week 1");
    expect(html).toContain("lg:col-span-12");
  });

  it("funnel shows the six seller steps in order", async () => {
    const html = await renderAsync(TrafficCountBlock({ weekly, ...TRAFFIC_COUNT_BLOCKS.funnel }));
    const labels = ["Sell clicks", "Registrations", "Drafts started", "Listings submitted", "Checkouts started", "Paid"];
    const positions = labels.map((label) => html.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain("Last week 5");
  });

  it("intent shows the three buyer signals", async () => {
    const html = await renderAsync(TrafficCountBlock({ weekly, ...TRAFFIC_COUNT_BLOCKS.intent }));
    expect(html).toContain("Listing views");
    expect(html).toContain("632");
    expect(html).toContain("Up 414% from 123");
    expect(html).toContain("lg:col-span-7");
  });

  it("renders its own named unavailable notice", async () => {
    const html = await renderAsync(
      TrafficCountBlock({ weekly: Promise.resolve(UNAVAILABLE), ...TRAFFIC_COUNT_BLOCKS.funnel }),
    );
    expect(html).toContain('aria-label="Seller funnel"');
    expect(html).toContain("Traffic data is unavailable.");
  });
});

describe("other traffic blocks", () => {
  it("TrafficEngagementBlock shows bounce rate in points and session length", async () => {
    const html = await renderAsync(TrafficEngagementBlock({ engagement: Promise.resolve(ENGAGEMENT) }));
    expect(html).toContain("10.7%");
    expect(html).toContain("Down 16.6 pts from 27.3%");
    expect(html).toContain("8m 58s");
  });

  it("TrafficEngagementBlock and TrafficChartBlock render their unavailable notices", async () => {
    expect(await renderAsync(TrafficEngagementBlock({ engagement: Promise.resolve(UNAVAILABLE) }))).toContain("Traffic data is unavailable.");
    expect(await renderAsync(TrafficChartBlock({ daily: Promise.resolve(UNAVAILABLE) }))).toContain("Traffic data is unavailable.");
  });

  it("one failed endpoint leaves the other blocks rendering", async () => {
    const tiles = await renderAsync(TrafficCountBlock({ weekly: Promise.resolve(WEEKLY), ...TRAFFIC_COUNT_BLOCKS.headline }));
    const engagement = await renderAsync(TrafficEngagementBlock({ engagement: Promise.resolve(UNAVAILABLE) }));
    expect(tiles).toContain("2,156");
    expect(tiles).not.toContain("unavailable");
    expect(engagement).toContain("Traffic data is unavailable.");
  });

  it("TrafficChartBlock forwards every day with its label, values and partial flag", async () => {
    const html = await renderAsync(TrafficChartBlock({ daily: Promise.resolve(DAILY) }));
    const points = JSON.parse(html.replace(/^points:/, "").replaceAll("&quot;", '"'));
    expect(points).toEqual([
      { label: "Nov 19", visitors: 65, pageviews: 914, isPartial: false },
      { label: "Nov 20", visitors: 29, pageviews: 347, isPartial: true },
    ]);
  });

  it("TrafficAsOf shows the oldest refresh, or nothing when every block failed", async () => {
    const html = await renderAsync(TrafficAsOf({ results: Promise.resolve([WEEKLY, UNAVAILABLE]) }));
    expect(html).toContain("As of Nov 20, 4:10 PM ET.");
    expect(await renderAsync(TrafficAsOf({ results: Promise.resolve([UNAVAILABLE]) }))).toBe("");
  });

  it("TrafficUnavailable names its block, visibly and for screen readers", () => {
    const html = renderToStaticMarkup(React.createElement(TrafficUnavailable, { label: "Engagement", className: TRAFFIC_BLOCK_SPAN.engagement }));
    expect(html).toContain('aria-label="Engagement"');
    expect(html).toMatch(/uppercase">Engagement<\/p>/);
    expect(html).toContain("lg:col-span-5");
    expect(html).toContain("Try again in a few minutes.");
  });
});

describe("traffic skeletons", () => {
  it("a cluster skeleton uses the StatCluster cell grid for its count", () => {
    const html = renderToStaticMarkup(React.createElement(TrafficClusterSkeleton, { cells: 3, className: "x-span" }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("x-span");
    expect(html).toContain("@container");
    expect(html).toContain(statClusterCellsClass(3));
    expect(html.match(/h-6 w-12/g)).toHaveLength(3);
  });

  it("count, engagement, chart and as-of skeletons match their blocks", () => {
    const funnel = renderToStaticMarkup(React.createElement(TrafficCountSkeleton, { block: TRAFFIC_COUNT_BLOCKS.funnel }));
    expect(funnel.match(/h-6 w-12/g)).toHaveLength(6);
    expect(funnel).toContain("lg:col-span-12");
    const engagement = renderToStaticMarkup(React.createElement(TrafficEngagementSkeleton));
    expect(engagement.match(/h-6 w-12/g)).toHaveLength(2);
    expect(engagement).toContain("lg:col-span-5");
    expect(renderToStaticMarkup(React.createElement(TrafficChartSkeleton))).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(React.createElement(TrafficAsOfSkeleton))).toContain('aria-hidden="true"');
  });

  it("the report skeleton holds all five blocks", () => {
    const html = renderToStaticMarkup(React.createElement(TrafficReportSkeleton));
    expect(html.match(/h-6 w-12/g)).toHaveLength(4 + 6 + 3 + 2);
    expect(html).toContain("lg:col-span-7");
    expect(html).toContain("lg:col-span-5");
  });
});

describe("statClusterCellsClass", () => {
  it("steps to two columns only for even counts and flows into a row for more than one", () => {
    expect(statClusterCellsClass(4)).toContain("@min-[15rem]:grid-cols-2");
    expect(statClusterCellsClass(3)).not.toContain("@min-[15rem]:grid-cols-2");
    expect(statClusterCellsClass(3)).toContain("@min-[24rem]:grid-flow-col");
    expect(statClusterCellsClass(1)).not.toContain("grid-flow-col");
  });
});

describe("TrafficChart", () => {
  const points = [
    { label: "Nov 18", visitors: 31, pageviews: 301, isPartial: false },
    { label: "Nov 19", visitors: 65, pageviews: 914, isPartial: false },
    { label: "Nov 20", visitors: 29, pageviews: 347, isPartial: true },
  ];

  it("toTrafficChartRows splits each series into a settled run and a dashed final segment", () => {
    const rows = toTrafficChartRows(points);
    expect(rows.map((row) => row.visitorsSettled)).toEqual([31, 65, null]);
    expect(rows.map((row) => row.visitorsPartial)).toEqual([null, 65, 29]);
    expect(rows.map((row) => row.pageviewsSettled)).toEqual([301, 914, null]);
    expect(rows.map((row) => row.pageviewsPartial)).toEqual([null, 914, 347]);
    expect(rows.map((row) => row.visitors)).toEqual([31, 65, 29]);
    expect(rows.map((row) => row.label)).toEqual(["Nov 18", "Nov 19", "Nov 20 so far"]);
  });

  it("toTrafficChartRows draws no dashed segment when the last day is complete", () => {
    const rows = toTrafficChartRows(points.map((point) => ({ ...point, isPartial: false })));
    expect(rows.every((row) => row.visitorsPartial === null && row.pageviewsPartial === null)).toBe(true);
    expect(rows.map((row) => row.visitorsSettled)).toEqual([31, 65, 29]);
    expect(rows.at(-1)?.label).toBe("Nov 20");
  });

  it("draws a visitors panel above a pageviews panel", async () => {
    const { TrafficChart } = await vi.importActual<typeof import("@/app/(admin)/admin/traffic/TrafficChart")>(
      "@/app/(admin)/admin/traffic/TrafficChart",
    );
    const html = renderToStaticMarkup(React.createElement(TrafficChart, { points }));
    expect(html).toContain("Visitors &amp; pageviews");
    expect(html).toContain("Last 3 days");
    expect(html.indexOf("Visitors</p>")).toBeLessThan(html.indexOf("Pageviews</p>"));
  });
});

describe("TrafficReport", () => {
  it("shows one not-connected notice and calls nothing when the vars are unset", async () => {
    queries.trafficConfigured.mockReturnValue(false);

    const html = await renderAsync(TrafficReport());

    expect(html).toContain("Traffic isn&#x27;t connected");
    expect(html).toContain("Add the PostHog API key to show traffic.");
    expect(queries.getTrafficWeekly).not.toHaveBeenCalled();
  });

  it("starts each read once for today's New York date, behind per-block fallbacks", async () => {
    const html = await renderAsync(TrafficReport());

    expect(queries.getTrafficWeekly).toHaveBeenCalledTimes(1);
    expect(queries.getTrafficWeekly).toHaveBeenCalledWith("2026-11-20");
    expect(queries.getTrafficDaily).toHaveBeenCalledWith("2026-11-20");
    expect(queries.getTrafficEngagement).toHaveBeenCalledWith("2026-11-20");
    expect(html).toContain("Weeks are the last 7 days including today.");
    expect(html).toContain("Visitor counts exclude test accounts");
    expect(html).toContain("count every event.");
  });
});

describe("AdminTrafficPage", () => {
  it("renders the static header with the PostHog link above the streamed report", () => {
    const html = renderToStaticMarkup(React.createElement(AdminTrafficPage));
    expect(html).toContain("<h1");
    expect(html).toContain("Traffic");
    expect(html).toContain("Visitors and funnels from PostHog.");
    expect(html).toContain("Open PostHog");
  });
});

describe("AdminChartPanel", () => {
  it("titles its content", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminChartPanel, {
        title: "Fees collected",
        subtitle: "Weekly publishing fees",
        children: "chart",
      }),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Fees collected");
    expect(html).toContain("Weekly publishing fees");
    expect(html).toContain("chart");
  });
});

describe("MetricsCharts after the AdminChartPanel move", () => {
  it("still renders all five panels, each with a chart, location full width", () => {
    const bars = [{ label: "A", count: 1 }];
    const html = renderToStaticMarkup(
      React.createElement(MetricsCharts, {
        series: [{ week: "Nov 9", listings_created: 2, listings_sold: 1, new_users: 3, fees_collected_cents: 500 }],
        categories: bars,
        priceBands: bars,
        locations: bars,
      }),
    );
    for (const title of ["Listings &amp; users", "Fees collected", "By category", "By price", "By location"]) {
      expect(html).toContain(`>${title}</h2>`);
    }
    expect(html.match(/data-slot="chart"/g)).toHaveLength(5);
    expect(html).toMatch(/surface-panel hairline rounded-2xl p-4 sm:p-5 lg:col-span-2/);
  });
});

describe("AdminNav", () => {
  it("links to Traffic and marks it current on /admin/traffic", () => {
    const html = renderToStaticMarkup(React.createElement(AdminNav));
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/traffic"|<a[^>]*href="\/admin\/traffic"[^>]*aria-current="page"/);
    expect(html).toContain("Metrics");
  });
});
