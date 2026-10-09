import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_OFF_MARKET_STATUS,
  adminListQuery,
  adminListResult,
  clampPage,
  endOfDayMs,
  fetchAdminListPage,
  pageRange,
  paginateAdminList,
  parseAdminListParams,
  queueCutoffDate,
  segmentCutoffIso,
  startOfDayMs,
  totalPagesFor,
} from "@/lib/admin/list";

import type { AdminListParams } from "@/lib/admin/list";

const dated = (created_at: string) => ({ created_at });

function params(overrides: Partial<AdminListParams> = {}): AdminListParams {
  return {
    status: "all",
    searchQuery: "",
    query: "",
    actor: "all",
    from: "",
    to: "",
    page: 1,
    ...overrides,
  };
}

describe("parseAdminListParams", () => {
  it("defaults every param when the URL is bare", () => {
    expect(parseAdminListParams({})).toEqual({
      status: "all",
      searchQuery: "",
      query: "",
      actor: "all",
      from: "",
      to: "",
      page: 1,
    });
  });

  it("reads every param off the URL", () => {
    expect(
      parseAdminListParams({
        status: "sold",
        q: "Lace",
        actor: "seller",
        from: "2026-01-01",
        to: "2026-02-01",
        page: "3",
      }),
    ).toEqual({
      status: "sold",
      searchQuery: "Lace",
      query: "lace",
      actor: "seller",
      from: "2026-01-01",
      to: "2026-02-01",
      page: 3,
    });
  });

  it.each(["admin", "seller", "system"])("accepts the %s actor role", (role) => {
    expect(parseAdminListParams({ actor: role }).actor).toBe(role);
  });

  it("falls back to all rather than emptying the table on an unknown actor", () => {
    expect(parseAdminListParams({ actor: "robot" }).actor).toBe("all");
    expect(parseAdminListParams({ actor: "" }).actor).toBe("all");
  });

  it("keeps the raw search value and normalizes only the match key", () => {
    const parsed = parseAdminListParams({ q: "  IVORY  " });
    expect(parsed.searchQuery).toBe("  IVORY  ");
    expect(parsed.query).toBe("ivory");
  });

  it("takes the first value when a param repeats", () => {
    expect(parseAdminListParams({ status: ["sold", "active"] }).status).toBe(
      "sold",
    );
  });

  it("falls back to page 1 for junk page values", () => {
    expect(parseAdminListParams({ page: "0" }).page).toBe(1);
    expect(parseAdminListParams({ page: "-2" }).page).toBe(1);
    expect(parseAdminListParams({ page: "abc" }).page).toBe(1);
  });
});

describe("queueCutoffDate", () => {
  const asOf = "2026-07-31T18:00:00.000Z";

  it("returns the date N days before the reference, as a to-param", () => {
    expect(queueCutoffDate(30, asOf)).toBe("2026-07-01");
    expect(queueCutoffDate(2, asOf)).toBe("2026-07-29");
  });

  it("crosses a month boundary", () => {
    expect(queueCutoffDate(45, asOf)).toBe("2026-06-16");
  });

  it("returns the reference day itself for zero days", () => {
    expect(queueCutoffDate(0, asOf)).toBe("2026-07-31");
  });

  it("selects the same rows the linked list page would", () => {
    const rows = [
      dated("2026-04-01T12:00:00.000Z"),
      dated("2026-07-01T23:00:00.000Z"),
      dated("2026-07-20T14:00:00.000Z"),
    ];

    // The whole cutoff day is in range, matching the list page's `to` bound.
    const cutoff = endOfDayMs(queueCutoffDate(30, asOf));
    expect(rows.filter((r) => Date.parse(r.created_at) <= cutoff)).toEqual([
      rows[0],
      rows[1],
    ]);
  });
});

describe("paginateAdminList", () => {
  const rows = Array.from({ length: 65 }, (_, i) => ({ id: i }));

  it("paginates at the admin page size and reports the full count", () => {
    const result = paginateAdminList(rows, params());
    expect(result.rows).toHaveLength(30);
    expect(result.totalCount).toBe(65);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it("clamps a page past the end and reflects the clamp in the querystring", () => {
    const result = paginateAdminList(rows, params({ page: 99 }));
    expect(result.page).toBe(3);
    expect(result.current.get("page")).toBe("3");
  });

  it("omits page 1 and an all segment from the querystring", () => {
    const result = paginateAdminList(rows, params());
    expect(result.current.toString()).toBe("");
  });

  it("carries the active filters into the querystring", () => {
    const result = paginateAdminList(
      rows,
      params({
        status: "sold",
        searchQuery: "Lace",
        from: "2026-01-01",
        to: "2026-02-01",
      }),
    );

    expect(result.current.get("status")).toBe("sold");
    expect(result.current.get("q")).toBe("Lace");
    expect(result.current.get("from")).toBe("2026-01-01");
    expect(result.current.get("to")).toBe("2026-02-01");
  });

  it("returns the parsed params for the filter bar to render from", () => {
    const parsed = params({ status: "banned", searchQuery: "a@b.com" });
    expect(paginateAdminList(rows, parsed).params).toBe(parsed);
  });

  it("reports one page for an empty result", () => {
    const result = paginateAdminList([], params());
    expect(result.rows).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("round-trips the off-market segment through the URL params", () => {
    const parsed = parseAdminListParams({ status: ADMIN_OFF_MARKET_STATUS });
    expect(parsed.status).toBe(ADMIN_OFF_MARKET_STATUS);
    expect(paginateAdminList([], parsed).current.get("status")).toBe(
      ADMIN_OFF_MARKET_STATUS,
    );
  });
});

describe("endOfDayMs", () => {
  it("covers the whole New York end day, not midnight on it", () => {
    expect(endOfDayMs("2026-03-31")).toBe(
      new Date("2026-04-01T04:00:00.000Z").getTime() - 1,
    );
  });

  it("ends a 25-hour fall-back day at New York midnight", () => {
    expect(endOfDayMs("2026-11-01")).toBe(
      new Date("2026-11-02T05:00:00.000Z").getTime() - 1,
    );
  });

  it("stays NaN for an unparseable date instead of throwing", () => {
    expect(endOfDayMs("not-a-date")).toBeNaN();
  });
});

describe("startOfDayMs", () => {
  it("starts at New York midnight in both standard and daylight time", () => {
    expect(startOfDayMs("2026-01-15")).toBe(Date.parse("2026-01-15T05:00:00.000Z"));
    expect(startOfDayMs("2026-09-10")).toBe(Date.parse("2026-09-10T04:00:00.000Z"));
  });

  it("starts a spring-forward day before the 2 AM jump", () => {
    expect(startOfDayMs("2026-03-08")).toBe(Date.parse("2026-03-08T05:00:00.000Z"));
  });

  it("stays NaN for an unparseable date instead of throwing", () => {
    expect(startOfDayMs("not-a-date")).toBeNaN();
  });
});

describe("totalPagesFor / clampPage", () => {
  it("reports one page for an empty result rather than zero", () => {
    expect(totalPagesFor(0)).toBe(1);
  });

  it("rounds a partial page up", () => {
    expect(totalPagesFor(31)).toBe(2);
    expect(totalPagesFor(60)).toBe(2);
  });

  it("clamps to both ends of the range", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(99, 3)).toBe(3);
    expect(clampPage(2, 3)).toBe(2);
  });
});

describe("pageRange", () => {
  it("returns an inclusive zero-based range at the admin page size", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 29 });
    expect(pageRange(3)).toEqual({ from: 60, to: 89 });
  });

  it("treats a page below one as the first page", () => {
    expect(pageRange(0)).toEqual({ from: 0, to: 29 });
  });
});

describe("adminListQuery", () => {
  it("omits page 1 and an all segment", () => {
    expect(adminListQuery(params(), 1).toString()).toBe("");
  });

  it("carries every active filter", () => {
    const current = adminListQuery(
      params({
        status: "sold",
        searchQuery: "Lace",
        actor: "system",
        from: "2026-01-01",
        to: "2026-02-01",
      }),
      2,
    );
    expect(current.get("status")).toBe("sold");
    expect(current.get("q")).toBe("Lace");
    expect(current.get("actor")).toBe("system");
    expect(current.get("from")).toBe("2026-01-01");
    expect(current.get("to")).toBe("2026-02-01");
    expect(current.get("page")).toBe("2");
  });

  it("omits an all actor and round-trips a real one", () => {
    expect(adminListQuery(params(), 1).has("actor")).toBe(false);

    const roundTripped = parseAdminListParams(
      Object.fromEntries(adminListQuery(params({ actor: "admin" }), 1)),
    );
    expect(roundTripped.actor).toBe("admin");
  });
});

describe("segmentCutoffIso", () => {
  const asOf = "2026-07-31T18:00:00.000Z";

  it("looks back to the end of the cutoff day for an older segment", () => {
    // Same boundary the list page applies to a `to` bound.
    expect(segmentCutoffIso({ days: 30, side: "older" }, asOf)).toBe(
      new Date(endOfDayMs("2026-07-01")).toISOString(),
    );
  });

  it("looks forward from the start of the cutoff day for a newer segment", () => {
    expect(segmentCutoffIso({ days: 7, side: "newer" }, asOf)).toBe(
      "2026-07-24T04:00:00.000Z",
    );
  });
});

describe("adminListResult", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));

  it("derives pages from the server count, not the rows on hand", () => {
    const result = adminListResult(rows, 65, params());
    expect(result.rows).toHaveLength(30);
    expect(result.totalCount).toBe(65);
    expect(result.totalPages).toBe(3);
  });

  it("clamps a page past the end and reflects it in the querystring", () => {
    const result = adminListResult(rows, 65, params({ page: 99 }));
    expect(result.page).toBe(3);
    expect(result.current.get("page")).toBe("3");
  });
});

describe("fetchAdminListPage", () => {
  it("requests the range for the page asked for", async () => {
    const run = vi.fn().mockResolvedValue({ rows: [1], count: 65 });
    const result = await fetchAdminListPage(params({ page: 2 }), run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ from: 30, to: 59 });
    expect(result.page).toBe(2);
  });

  it("refetches the last real page when the requested one is past the end", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], count: 65 })
      .mockResolvedValueOnce({ rows: [9], count: 65 });

    const result = await fetchAdminListPage(params({ page: 99 }), run);

    expect(run).toHaveBeenNthCalledWith(1, { from: 2940, to: 2969 });
    expect(run).toHaveBeenNthCalledWith(2, { from: 60, to: 89 });
    expect(result.rows).toEqual([9]);
    expect(result.page).toBe(3);
  });

  it("does not refetch when the result is legitimately empty", async () => {
    const run = vi.fn().mockResolvedValue({ rows: [], count: 0 });
    const result = await fetchAdminListPage(params({ page: 4 }), run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
  });
});
