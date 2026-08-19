import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminDemoMode } from "@/app/(admin)/admin-demo";
import {
  FIXTURE_AUDIT_LOG,
  FIXTURE_LISTINGS,
  FIXTURE_MESSAGES,
  FIXTURE_PAYMENTS,
  FIXTURE_USERS,
  demoAuditLog,
  demoListings,
  demoMessages,
  demoMetrics,
  demoOverview,
  demoPayments,
  demoUsers,
} from "@/app/(admin)/admin-fixtures";
import {
  ADMIN_DEMO_COOKIE,
  ADMIN_METRICS_WEEKS,
  ADMIN_QUEUE_PREVIEW_SIZE,
} from "@/lib/admin/constants";
import {
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STUCK_PAYMENT_SEGMENT,
} from "@/lib/admin/list";

import type { AdminListParams } from "@/lib/admin/list";

const { cookieStore, setCookie } = vi.hoisted(() => {
  const jar = new Map<string, { value: string }>();
  return {
    cookieStore: { get: (name: string) => jar.get(name) },
    setCookie: (name: string, value: string | null) => {
      jar.clear();
      if (value !== null) jar.set(name, { value });
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStore),
}));

function params(overrides: Partial<AdminListParams> = {}): AdminListParams {
  return {
    status: "all",
    searchQuery: "",
    query: "",
    from: "",
    to: "",
    page: 1,
    ...overrides,
  };
}

beforeEach(() => {
  setCookie(ADMIN_DEMO_COOKIE, null);
});

describe("isAdminDemoMode", () => {
  it("is off when the cookie is absent", async () => {
    await expect(isAdminDemoMode()).resolves.toBe(false);
  });

  it("is on for the exact opt-in value", async () => {
    setCookie(ADMIN_DEMO_COOKIE, "1");
    await expect(isAdminDemoMode()).resolves.toBe(true);
  });

  it("stays off for any other value, including a cleared cookie", async () => {
    for (const value of ["", "0", "true", "yes"]) {
      setCookie(ADMIN_DEMO_COOKIE, value);
      await expect(isAdminDemoMode()).resolves.toBe(false);
    }
  });
});

describe("demoListings", () => {
  it("returns every fixture listing for the all segment, newest first", () => {
    const result = demoListings(params());

    expect(result.totalCount).toBe(FIXTURE_LISTINGS.length);
    const dates = result.rows.map((l) => new Date(l.created_at).getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it("filters a plain status segment", () => {
    const result = demoListings(params({ status: "sold" }));
    expect(result.rows.every((l) => l.status === "sold")).toBe(true);
    expect(result.totalCount).toBeGreaterThan(0);
  });

  it("covers both statuses in the off-market segment", () => {
    const result = demoListings(params({ status: ADMIN_OFF_MARKET_STATUS }));
    expect(result.rows.map((l) => l.status).sort()).toEqual([
      "removed",
      "suspended",
    ]);
  });

  it("applies an age segment against the fixture clock", () => {
    const result = demoListings(params({ status: ADMIN_STUCK_PAYMENT_SEGMENT }));
    expect(result.rows.every((l) => l.status === "pending_payment")).toBe(true);
  });

  it("searches the title case-insensitively", () => {
    const result = demoListings(params({ query: "ivory" }));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toContain("Ivory");
  });

  it("carries the segment into the querystring", () => {
    const result = demoListings(params({ status: "sold" }));
    expect(result.current.get("status")).toBe("sold");
  });
});

describe("demoUsers", () => {
  it("returns every fixture user for the all segment", () => {
    expect(demoUsers(params()).totalCount).toBe(FIXTURE_USERS.length);
  });

  it("filters the banned segment", () => {
    const result = demoUsers(params({ status: "banned" }));
    expect(result.rows.every((u) => u.is_banned)).toBe(true);
    expect(result.totalCount).toBe(1);
  });

  it("filters the admins segment", () => {
    const result = demoUsers(params({ status: "admin" }));
    expect(result.rows.every((u) => u.is_admin)).toBe(true);
  });

  it("filters the active segment to unbanned accounts", () => {
    const result = demoUsers(params({ status: "active" }));
    expect(result.rows.every((u) => !u.is_banned)).toBe(true);
  });

  it("searches by email", () => {
    const result = demoUsers(params({ query: "leah" }));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toContain("leah");
  });
});

describe("demoMessages", () => {
  it("returns every fixture message", () => {
    expect(demoMessages(params()).totalCount).toBe(FIXTURE_MESSAGES.length);
  });

  it("searches by email", () => {
    const result = demoMessages(params({ query: "press" }));
    expect(result.rows).toHaveLength(1);
  });

  it("orders newest first", () => {
    const dates = demoMessages(params()).rows.map((m) =>
      new Date(m.created_at).getTime(),
    );
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });
});

describe("demoPayments", () => {
  it("returns every fixture payment row", () => {
    expect(demoPayments(params()).totalCount).toBe(FIXTURE_PAYMENTS.length);
  });

  it("filters by status", () => {
    const result = demoPayments(params({ status: "succeeded" }));
    expect(result.rows.every((p) => p.status === "succeeded")).toBe(true);
  });

  it("searches the listing title, matching the real query's one search field", () => {
    const result = demoPayments(params({ query: "navy" }));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].listing_title).toContain("Navy");
  });
});

describe("demoAuditLog", () => {
  it("returns every fixture entry", () => {
    expect(demoAuditLog(params()).totalCount).toBe(FIXTURE_AUDIT_LOG.length);
  });

  it("filters by entity type", () => {
    const result = demoAuditLog(params({ status: "user" }));
    expect(result.rows.every((e) => e.entity_type === "user")).toBe(true);
  });

  it("searches the actor", () => {
    expect(demoAuditLog(params({ query: "admin@" })).totalCount).toBe(
      FIXTURE_AUDIT_LOG.length,
    );
  });

  it("searches the stored action slug", () => {
    const result = demoAuditLog(params({ query: "listing.suspend" }));
    expect(result.rows).toHaveLength(1);
  });
});

describe("demoOverview", () => {
  it("returns the same shape the real overview query does", () => {
    const overview = demoOverview();

    expect(Object.keys(overview).sort()).toEqual([
      "asOf",
      "newThisWeek",
      "offMarket",
      "recentActivity",
      "staleActives",
      "stats",
      "stuckPending",
    ]);
    for (const queue of [
      overview.newThisWeek,
      overview.staleActives,
      overview.offMarket,
      overview.stuckPending,
    ]) {
      expect(queue.count).toBe(queue.rows.length);
    }
  });

  it("agrees with the listings page on what each segment selects", () => {
    const overview = demoOverview();
    expect(overview.offMarket.count).toBe(
      demoListings(params({ status: ADMIN_OFF_MARKET_STATUS })).totalCount,
    );
    expect(overview.stuckPending.count).toBe(
      demoListings(params({ status: ADMIN_STUCK_PAYMENT_SEGMENT })).totalCount,
    );
  });

  it("caps the activity feed at the preview size", () => {
    expect(demoOverview().recentActivity.length).toBeLessThanOrEqual(
      ADMIN_QUEUE_PREVIEW_SIZE,
    );
  });
});

describe("demoMetrics", () => {
  it("returns the same shape the real metrics query does", () => {
    const metrics = demoMetrics();
    expect(Object.keys(metrics).sort()).toEqual(["series", "stats", "summary"]);
  });

  it("returns the configured metrics window", () => {
    expect(demoMetrics().series).toHaveLength(ADMIN_METRICS_WEEKS);
  });

  it("shares category ids with the real data so both label the same way", () => {
    expect(demoMetrics().summary.category_share[0].category).toBe("bridal");
  });

  it("returns stored location values, not labels", () => {
    const { location_share } = demoMetrics().summary;
    expect(location_share.length).toBeGreaterThan(0);
    expect(location_share[0].location).toBe("Lakewood");
  });

  it("returns every price band in scale order, including empty ones", () => {
    expect(demoMetrics().summary.price_bands.map((b) => b.band)).toEqual([
      "under_100",
      "100_249",
      "250_499",
      "500_999",
      "1000_plus",
    ]);
  });

  it("derives the condition mix from the listing fixtures", () => {
    const mix = demoMetrics().summary.condition_mix;
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    expect(total).toBe(FIXTURE_LISTINGS.length);
    expect(mix["Perfect Condition"]).toBe(
      FIXTURE_LISTINGS.filter((l) => l.condition === "Perfect Condition").length,
    );
  });

  it("derives the sell-mode mix from the listing fixtures", () => {
    const mix = demoMetrics().summary.sell_mode_mix;
    expect(Object.values(mix).reduce((a, b) => a + b, 0)).toBe(
      FIXTURE_LISTINGS.length,
    );
    expect(mix.set_only).toBe(
      FIXTURE_LISTINGS.filter((l) => l.sell_mode === "set_only").length,
    );
  });

  it("derives payment conversion from the payment fixtures", () => {
    const { payments } = demoMetrics().summary;
    expect(payments.attempts).toBe(FIXTURE_PAYMENTS.length);
    expect(payments.succeeded).toBe(
      FIXTURE_PAYMENTS.filter((p) => p.status === "succeeded").length,
    );
  });

  it("picks the most-saved listing", () => {
    const top = demoMetrics().summary.most_wishlisted;
    const expected = Math.max(...FIXTURE_LISTINGS.map((l) => l.saved_count));
    expect(top?.saves).toBe(expected);
  });

  it("reports the zero-available-size invariant as clean", () => {
    expect(demoMetrics().summary.actives_with_no_available_size).toBe(0);
  });
});
