import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
  ADMIN_STUCK_PAYMENT_SEGMENT,
  AGE_SEGMENTS,
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
  totalPagesFor,
} from "@/lib/admin/list";
import {
  filterByDateRange,
  matchesListingSegment,
  matchesListingStatus,
} from "@/app/(admin)/admin-list";

import type { AdminListParams } from "@/lib/admin/list";

const dated = (created_at: string) => ({ created_at });

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

describe("parseAdminListParams", () => {
  it("defaults every param when the URL is bare", () => {
    expect(parseAdminListParams({})).toEqual({
      status: "all",
      searchQuery: "",
      query: "",
      from: "",
      to: "",
      page: 1,
    });
  });

  it("reads all five params off the URL", () => {
    expect(
      parseAdminListParams({
        status: "sold",
        q: "Lace",
        from: "2026-01-01",
        to: "2026-02-01",
        page: "3",
      }),
    ).toEqual({
      status: "sold",
      searchQuery: "Lace",
      query: "lace",
      from: "2026-01-01",
      to: "2026-02-01",
      page: 3,
    });
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

describe("filterByDateRange", () => {
  const items = [
    dated("2026-01-01T12:00:00.000Z"),
    dated("2026-02-15T09:30:00.000Z"),
    dated("2026-03-31T23:59:00.000Z"),
  ];
  const getDate = (item: { created_at: string }) => item.created_at;

  it("returns everything when neither bound is set", () => {
    expect(filterByDateRange(items, params(), getDate)).toHaveLength(3);
  });

  it("keeps rows on or after from", () => {
    const filtered = filterByDateRange(
      items,
      params({ from: "2026-02-15" }),
      getDate,
    );
    expect(filtered).toHaveLength(2);
  });

  it("covers the whole end day, not midnight on it", () => {
    const filtered = filterByDateRange(
      items,
      params({ to: "2026-03-31" }),
      getDate,
    );
    expect(filtered).toHaveLength(3);
  });

  it("applies both bounds together", () => {
    const filtered = filterByDateRange(
      items,
      params({ from: "2026-02-01", to: "2026-02-28" }),
      getDate,
    );
    expect(filtered).toEqual([dated("2026-02-15T09:30:00.000Z")]);
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

    // The whole cutoff day is in range, matching filterByDateRange's `to`.
    expect(
      filterByDateRange(rows, params({ to: queueCutoffDate(30, asOf) }), (r) => r.created_at),
    ).toEqual([rows[0], rows[1]]);
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
});

describe("matchesListingStatus", () => {
  it("matches every row when nothing is selected", () => {
    for (const status of [
      "active",
      "sold",
      "pending_payment",
      "suspended",
      "removed",
    ]) {
      expect(matchesListingStatus("all", status)).toBe(true);
    }
  });

  it("matches only the exact status for a single-status segment", () => {
    expect(matchesListingStatus("removed", "removed")).toBe(true);
    expect(matchesListingStatus("removed", "suspended")).toBe(false);
    expect(matchesListingStatus("suspended", "suspended")).toBe(true);
    expect(matchesListingStatus("suspended", "removed")).toBe(false);
  });

  it("matches both off-market statuses for the composite segment", () => {
    expect(matchesListingStatus(ADMIN_OFF_MARKET_STATUS, "suspended")).toBe(
      true,
    );
    expect(matchesListingStatus(ADMIN_OFF_MARKET_STATUS, "removed")).toBe(true);
  });

  it("keeps on-market statuses out of the composite segment", () => {
    for (const status of ["active", "sold", "pending_payment"]) {
      expect(matchesListingStatus(ADMIN_OFF_MARKET_STATUS, status)).toBe(false);
    }
  });

  it("rejects everything for a segment value that is not a known status", () => {
    expect(matchesListingStatus("nonsense", "active")).toBe(false);
  });

  it("survives a round trip through the URL params", () => {
    const parsed = parseAdminListParams({ status: ADMIN_OFF_MARKET_STATUS });
    expect(parsed.status).toBe(ADMIN_OFF_MARKET_STATUS);
    expect(paginateAdminList([], parsed).current.get("status")).toBe(
      ADMIN_OFF_MARKET_STATUS,
    );
  });
});

describe("matchesListingSegment", () => {
  const asOf = "2026-07-31T18:00:00.000Z";
  const listing = (status: string, created_at: string) => ({ status, created_at });

  it("falls through to the status matcher for plain segments", () => {
    expect(
      matchesListingSegment("all", listing("sold", "2020-01-01T00:00:00.000Z"), asOf),
    ).toBe(true);
    expect(
      matchesListingSegment("active", listing("active", "2026-07-30T00:00:00.000Z"), asOf),
    ).toBe(true);
    expect(
      matchesListingSegment("active", listing("sold", "2026-07-30T00:00:00.000Z"), asOf),
    ).toBe(false);
    expect(
      matchesListingSegment(
        ADMIN_OFF_MARKET_STATUS,
        listing("suspended", "2026-07-30T00:00:00.000Z"),
        asOf,
      ),
    ).toBe(true);
  });

  it("requires both the status and the age for stale actives", () => {
    // Active and 30+ days old.
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listing("active", "2026-04-01T12:00:00.000Z"),
        asOf,
      ),
    ).toBe(true);
    // Old enough, wrong status.
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listing("sold", "2026-04-01T12:00:00.000Z"),
        asOf,
      ),
    ).toBe(false);
    // Right status, too recent.
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listing("active", "2026-07-20T14:00:00.000Z"),
        asOf,
      ),
    ).toBe(false);
  });

  it("includes the whole cutoff day on the older side", () => {
    // Cutoff is 2026-07-01; late that day still counts as older.
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listing("active", "2026-07-01T23:59:00.000Z"),
        asOf,
      ),
    ).toBe(true);
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listing("active", "2026-07-02T00:00:01.000Z"),
        asOf,
      ),
    ).toBe(false);
  });

  it("requires both the status and the age for stuck payments", () => {
    expect(
      matchesListingSegment(
        ADMIN_STUCK_PAYMENT_SEGMENT,
        listing("pending_payment", "2026-07-28T09:00:00.000Z"),
        asOf,
      ),
    ).toBe(true);
    expect(
      matchesListingSegment(
        ADMIN_STUCK_PAYMENT_SEGMENT,
        listing("active", "2026-07-28T09:00:00.000Z"),
        asOf,
      ),
    ).toBe(false);
    expect(
      matchesListingSegment(
        ADMIN_STUCK_PAYMENT_SEGMENT,
        listing("pending_payment", "2026-07-31T09:00:00.000Z"),
        asOf,
      ),
    ).toBe(false);
  });

  it("takes any status inside the new-this-week window", () => {
    expect(
      matchesListingSegment(
        ADMIN_NEW_WEEK_SEGMENT,
        listing("sold", "2026-07-28T09:00:00.000Z"),
        asOf,
      ),
    ).toBe(true);
    expect(
      matchesListingSegment(
        ADMIN_NEW_WEEK_SEGMENT,
        listing("active", "2026-07-20T09:00:00.000Z"),
        asOf,
      ),
    ).toBe(false);
  });

  it("rolls with asOf instead of freezing a date", () => {
    const listed = listing("active", "2026-07-20T14:00:00.000Z");
    // Not stale on Jul 31, stale once "now" has moved a month on.
    expect(matchesListingSegment(ADMIN_STALE_ACTIVE_SEGMENT, listed, asOf)).toBe(
      false,
    );
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        listed,
        "2026-09-01T18:00:00.000Z",
      ),
    ).toBe(true);
  });
});

describe("endOfDayMs", () => {
  it("covers the whole end day, not midnight on it", () => {
    expect(endOfDayMs("2026-03-31")).toBe(
      new Date("2026-04-01T00:00:00.000Z").getTime() - 1,
    );
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
      params({ status: "sold", searchQuery: "Lace", from: "2026-01-01", to: "2026-02-01" }),
      2,
    );
    expect(current.get("status")).toBe("sold");
    expect(current.get("q")).toBe("Lace");
    expect(current.get("from")).toBe("2026-01-01");
    expect(current.get("to")).toBe("2026-02-01");
    expect(current.get("page")).toBe("2");
  });
});

describe("segmentCutoffIso", () => {
  const asOf = "2026-07-31T18:00:00.000Z";

  it("looks back to the end of the cutoff day for an older segment", () => {
    // Same boundary filterByDateRange applies to a `to` bound, so the SQL
    // predicate and the in-memory matcher select the same rows.
    expect(segmentCutoffIso({ days: 30, side: "older" }, asOf)).toBe(
      new Date(endOfDayMs("2026-07-01")).toISOString(),
    );
  });

  it("looks forward from the start of the cutoff day for a newer segment", () => {
    expect(segmentCutoffIso({ days: 7, side: "newer" }, asOf)).toBe(
      "2026-07-24T00:00:00.000Z",
    );
  });

  it("agrees with the in-memory matcher on a row sitting on the boundary", () => {
    const rule = AGE_SEGMENTS[ADMIN_STALE_ACTIVE_SEGMENT];
    const boundary = segmentCutoffIso(rule, asOf);
    expect(
      matchesListingSegment(
        ADMIN_STALE_ACTIVE_SEGMENT,
        { status: "active", created_at: boundary },
        asOf,
      ),
    ).toBe(true);
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
