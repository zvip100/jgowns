import { describe, expect, it } from "vitest";

import {
  browsePageHref,
  browsePageRedirectTarget,
  formatBrowsePage,
  getBrowsePageNavItems,
  parseBrowsePage,
  totalPagesFromCount,
} from "@/lib/browse-pagination";

describe("browse-pagination", () => {
  describe("parseBrowsePage", () => {
    it("returns 1 for missing page param", () => {
      expect(parseBrowsePage({})).toBe(1);
    });

    it("parses a valid page number", () => {
      expect(parseBrowsePage({ page: "2" })).toBe(2);
      expect(parseBrowsePage({ page: "10" })).toBe(10);
    });

    it("returns 1 for non-numeric strings", () => {
      expect(parseBrowsePage({ page: "abc" })).toBe(1);
      expect(parseBrowsePage({ page: "1.5" })).toBe(1);
      expect(parseBrowsePage({ page: "" })).toBe(1);
    });

    it("returns 1 when page is less than 1", () => {
      expect(parseBrowsePage({ page: "0" })).toBe(1);
    });

    it("clamps to MAX_PAGE (10 000)", () => {
      expect(parseBrowsePage({ page: "99999" })).toBe(10_000);
    });

    it("uses the first value when page is an array", () => {
      expect(parseBrowsePage({ page: ["3", "7"] })).toBe(3);
    });
  });

  describe("formatBrowsePage", () => {
    it("returns undefined for page 1 (omit from URL)", () => {
      expect(formatBrowsePage(1)).toBeUndefined();
    });

    it("returns undefined for page <= 0", () => {
      expect(formatBrowsePage(0)).toBeUndefined();
      expect(formatBrowsePage(-1)).toBeUndefined();
    });

    it("returns the string representation for page > 1", () => {
      expect(formatBrowsePage(2)).toBe("2");
      expect(formatBrowsePage(100)).toBe("100");
    });
  });

  describe("totalPagesFromCount", () => {
    it("returns 0 when totalCount is 0", () => {
      expect(totalPagesFromCount(0, 8)).toBe(0);
    });

    it("returns 0 when totalCount is negative", () => {
      expect(totalPagesFromCount(-1, 8)).toBe(0);
    });

    it("returns 1 when count fits in one page", () => {
      expect(totalPagesFromCount(1, 8)).toBe(1);
      expect(totalPagesFromCount(8, 8)).toBe(1);
    });

    it("returns 2 when count exceeds one page by one", () => {
      expect(totalPagesFromCount(9, 8)).toBe(2);
    });

    it("calculates pages correctly for larger counts", () => {
      expect(totalPagesFromCount(16, 8)).toBe(2);
      expect(totalPagesFromCount(17, 8)).toBe(3);
      expect(totalPagesFromCount(100, 8)).toBe(13);
    });
  });

  describe("browsePageRedirectTarget", () => {
    it("returns null when totalCount is 0", () => {
      expect(browsePageRedirectTarget(1, 0, 0)).toBeNull();
      expect(browsePageRedirectTarget(5, 0, 0)).toBeNull();
    });

    it("returns null when page is 1", () => {
      expect(browsePageRedirectTarget(1, 5, 40)).toBeNull();
    });

    it("returns null when page is within bounds", () => {
      expect(browsePageRedirectTarget(3, 5, 40)).toBeNull();
      expect(browsePageRedirectTarget(5, 5, 40)).toBeNull();
    });

    it("returns 1 when page exceeds total pages", () => {
      expect(browsePageRedirectTarget(6, 5, 40)).toBe(1);
      expect(browsePageRedirectTarget(100, 5, 40)).toBe(1);
    });
  });

  describe("getBrowsePageNavItems", () => {
    it("returns empty array when total is 0 or 1", () => {
      expect(getBrowsePageNavItems(1, 0)).toEqual([]);
      expect(getBrowsePageNavItems(1, 1)).toEqual([]);
    });

    it("returns all pages when total is 7 or fewer", () => {
      expect(getBrowsePageNavItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
      expect(getBrowsePageNavItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("shows leading ellipsis when current is far from start (> 8 pages)", () => {
      const items = getBrowsePageNavItems(6, 10);
      expect(items[0]).toBe(1);
      expect(items).toContain("ellipsis");
      expect(items[items.length - 1]).toBe(10);
    });

    it("shows trailing ellipsis when current is far from end", () => {
      const items = getBrowsePageNavItems(1, 8);
      expect(items[0]).toBe(1);
      expect(items).toContain("ellipsis");
      expect(items[items.length - 1]).toBe(8);
    });

    it("always includes first and last page", () => {
      const items = getBrowsePageNavItems(5, 10);
      expect(items[0]).toBe(1);
      expect(items[items.length - 1]).toBe(10);
    });

    it("includes current page and ±2 neighbors", () => {
      const items = getBrowsePageNavItems(5, 10);
      const pageItems = items.filter((i): i is number => i !== "ellipsis");
      expect(pageItems).toContain(3);
      expect(pageItems).toContain(4);
      expect(pageItems).toContain(5);
      expect(pageItems).toContain(6);
      expect(pageItems).toContain(7);
    });

    it("handles current at the last page without trailing ellipsis", () => {
      const items = getBrowsePageNavItems(8, 8);
      const lastEllipsisIdx = [...items].reverse().findIndex((i) => i === "ellipsis");
      // Trailing ellipsis should not appear since current is at end
      const trailingItems = items.slice(-3);
      expect(trailingItems).not.toContain("ellipsis");
      expect(items[items.length - 1]).toBe(8);
    });
  });

  describe("browsePageHref", () => {
    it("returns /browse when params are empty and page is 1", () => {
      expect(browsePageHref({}, 1)).toBe("/browse");
    });

    it("returns /browse when page is 1 (page omitted)", () => {
      expect(browsePageHref({ category: "bridal" }, 1)).toBe(
        "/browse?category=bridal",
      );
    });

    it("appends page > 1 to the URL", () => {
      const href = browsePageHref({ category: "bridal" }, 2);
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("category")).toBe("bridal");
      expect(params.get("page")).toBe("2");
    });

    it("replaces an existing page param with targetPage", () => {
      const href = browsePageHref({ category: "bridal", page: "5" }, 3);
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("page")).toBe("3");
    });

    it("preserves all filter params", () => {
      const href = browsePageHref(
        { category: "girls", color: "Ivory", location: "Monsey" },
        1,
      );
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("category")).toBe("girls");
      expect(params.get("color")).toBe("Ivory");
      expect(params.get("location")).toBe("Monsey");
    });
  });
});
