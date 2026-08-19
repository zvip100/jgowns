import { describe, expect, it } from "vitest";

import {
  adminListHref,
  formatAdminDate,
  formatAdminDateTime,
  formatCents,
  stripeSessionUrl,
} from "@/app/(admin)/admin-url";
import { firstSearchParam, parsePageParam } from "@/lib/admin/list";

describe("adminListHref", () => {
  it("returns the bare pathname when nothing is set", () => {
    expect(adminListHref("/admin/listings", new URLSearchParams(), {})).toBe(
      "/admin/listings",
    );
  });

  it("preserves unrelated params and applies overrides", () => {
    const current = new URLSearchParams({ status: "sold", q: "lace", page: "3" });
    expect(
      adminListHref("/admin/listings", current, { page: "2" }),
    ).toBe("/admin/listings?status=sold&q=lace&page=2");
  });

  it("deletes a param when the override is undefined or empty", () => {
    const current = new URLSearchParams({ status: "sold", page: "3" });
    expect(
      adminListHref("/admin/listings", current, {
        status: undefined,
        page: "",
      }),
    ).toBe("/admin/listings");
  });

  it("does not mutate the params it was given", () => {
    const current = new URLSearchParams({ status: "sold" });
    adminListHref("/admin/listings", current, { status: "active" });
    expect(current.get("status")).toBe("sold");
  });
});

describe("firstSearchParam", () => {
  it("returns an empty string for undefined", () => {
    expect(firstSearchParam(undefined)).toBe("");
  });

  it("returns the value for a string", () => {
    expect(firstSearchParam("active")).toBe("active");
  });

  it("returns the first entry of an array", () => {
    expect(firstSearchParam(["active", "sold"])).toBe("active");
  });

  it("returns an empty string for an empty array", () => {
    expect(firstSearchParam([])).toBe("");
  });
});

describe("parsePageParam", () => {
  it("defaults to page 1", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
  });

  it("parses a positive integer", () => {
    expect(parsePageParam("4")).toBe(4);
    expect(parsePageParam(["7"])).toBe(7);
  });

  it("rejects zero, negatives, and non-numeric values", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-2")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });
});

describe("formatAdminDate", () => {
  it("formats an ISO timestamp as a short US date", () => {
    // Midday UTC so US time zones land on the same calendar day.
    expect(formatAdminDate("2026-07-20T14:00:00.000Z")).toBe("Jul 20, 2026");
  });
});

describe("formatAdminDateTime", () => {
  it("appends a time to the short US date", () => {
    const formatted = formatAdminDateTime("2026-07-20T14:00:00.000Z");
    expect(formatted).toContain("Jul 20, 2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });
});

describe("stripeSessionUrl", () => {
  it("links a test-mode session to the Checkout Sessions view", () => {
    expect(stripeSessionUrl("cs_test_a1b2")).toBe(
      "https://dashboard.stripe.com/test/checkout/sessions/cs_test_a1b2",
    );
  });

  it("drops the test segment for a live session", () => {
    expect(stripeSessionUrl("cs_live_a1b2")).toBe(
      "https://dashboard.stripe.com/checkout/sessions/cs_live_a1b2",
    );
  });
});

describe("formatCents", () => {
  it("renders cents as USD", () => {
    expect(formatCents(500)).toBe("$5.00");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(123456)).toBe("$1,234.56");
  });
});
