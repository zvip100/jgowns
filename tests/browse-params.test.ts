import { describe, expect, it } from "vitest";

import {
  canonicalBrowseQueryString,
  countActiveBrowseFilters,
  formatBrowseParamList,
  parseBrowseParamList,
  toPageSearchParams,
  toggleParamValue,
} from "@/lib/browse-params";

describe("browse-params", () => {
  describe("parseBrowseParamList", () => {
    it("returns empty array for null, undefined, and empty string", () => {
      expect(parseBrowseParamList(null)).toEqual([]);
      expect(parseBrowseParamList(undefined)).toEqual([]);
      expect(parseBrowseParamList("")).toEqual([]);
    });

    it("returns a single value wrapped in an array", () => {
      expect(parseBrowseParamList("a")).toEqual(["a"]);
    });

    it("splits comma-separated string into values", () => {
      expect(parseBrowseParamList("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("trims whitespace from each value", () => {
      expect(parseBrowseParamList(" a , b ")).toEqual(["a", "b"]);
    });

    it("deduplicates repeated values", () => {
      expect(parseBrowseParamList("a,b,a")).toEqual(["a", "b"]);
    });

    it("flattens an array of comma-separated strings", () => {
      expect(parseBrowseParamList(["a,b", "c"])).toEqual(["a", "b", "c"]);
    });

    it("filters out empty parts from consecutive commas", () => {
      expect(parseBrowseParamList("a,,b")).toEqual(["a", "b"]);
    });

    it("deduplicates across array entries", () => {
      expect(parseBrowseParamList(["a", "a"])).toEqual(["a"]);
    });
  });

  describe("formatBrowseParamList", () => {
    it("joins values with a comma", () => {
      expect(formatBrowseParamList(["a", "b", "c"])).toBe("a,b,c");
    });

    it("returns empty string for an empty array", () => {
      expect(formatBrowseParamList([])).toBe("");
    });

    it("trims each value before joining", () => {
      expect(formatBrowseParamList([" a ", " b "])).toBe("a,b");
    });

    it("deduplicates values", () => {
      expect(formatBrowseParamList(["a", "b", "a"])).toBe("a,b");
    });

    it("filters out empty strings", () => {
      expect(formatBrowseParamList(["a", "", "b"])).toBe("a,b");
    });
  });

  describe("toggleParamValue", () => {
    it("adds a value that is absent", () => {
      expect(toggleParamValue(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    });

    it("removes a value that is present", () => {
      expect(toggleParamValue(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    });

    it("adds to an empty list", () => {
      expect(toggleParamValue([], "a")).toEqual(["a"]);
    });

    it("removes the only value, yielding an empty list", () => {
      expect(toggleParamValue(["a"], "a")).toEqual([]);
    });

    it("preserves order of the remaining values when adding", () => {
      expect(toggleParamValue(["a:8", "a:10"], "a:12")).toEqual([
        "a:8",
        "a:10",
        "a:12",
      ]);
    });

    it("does not mutate the input list", () => {
      const input = ["a", "b"];
      toggleParamValue(input, "c");
      expect(input).toEqual(["a", "b"]);
    });
  });

  describe("countActiveBrowseFilters", () => {
    it("returns 0 when no filter params are present", () => {
      expect(countActiveBrowseFilters(new URLSearchParams())).toBe(0);
    });

    it("counts each filter category once regardless of how many values it holds", () => {
      const p = new URLSearchParams("size=a:8,a:10,a:12,a:14,a:16");
      expect(countActiveBrowseFilters(p)).toBe(1);
    });

    it("counts a two-sided price range as a single category", () => {
      const p = new URLSearchParams("minPrice=500&maxPrice=2000");
      expect(countActiveBrowseFilters(p)).toBe(1);
    });

    it("counts a one-sided price as a single category", () => {
      expect(countActiveBrowseFilters(new URLSearchParams("minPrice=500"))).toBe(1);
      expect(countActiveBrowseFilters(new URLSearchParams("maxPrice=2000"))).toBe(1);
    });

    it("counts size plus a price range as 2", () => {
      const p = new URLSearchParams("size=a:8,a:10&minPrice=500&maxPrice=2000");
      expect(countActiveBrowseFilters(p)).toBe(2);
    });

    it("does not count the category nav param as a filter", () => {
      const p = new URLSearchParams("category=bridal");
      expect(countActiveBrowseFilters(p)).toBe(0);
    });
  });

  describe("canonicalBrowseQueryString", () => {
    it("orders params according to BROWSE_PARAM_ORDER (category before color)", () => {
      const p = new URLSearchParams("color=Pink&category=bridal");
      const qs = canonicalBrowseQueryString(p);
      expect(qs.indexOf("category")).toBeLessThan(qs.indexOf("color"));
    });

    it("omits page=1 to keep canonical URLs clean", () => {
      const p = new URLSearchParams("category=bridal&page=1");
      expect(canonicalBrowseQueryString(p)).not.toContain("page");
    });

    it("preserves page when greater than 1", () => {
      const p = new URLSearchParams("category=bridal&page=2");
      const qs = canonicalBrowseQueryString(p);
      expect(new URLSearchParams(qs).get("page")).toBe("2");
    });

    it("drops unknown params", () => {
      const p = new URLSearchParams("foo=bar&category=bridal");
      const qs = canonicalBrowseQueryString(p);
      expect(qs).not.toContain("foo");
      expect(new URLSearchParams(qs).get("category")).toBe("bridal");
    });

    it("returns empty string when no known params are present", () => {
      const p = new URLSearchParams("foo=bar");
      expect(canonicalBrowseQueryString(p)).toBe("");
    });

    it("returns empty string for empty URLSearchParams", () => {
      expect(canonicalBrowseQueryString(new URLSearchParams())).toBe("");
    });
  });

  describe("toPageSearchParams", () => {
    it("extracts single-value params as strings", () => {
      const p = new URLSearchParams("category=bridal&color=Pink");
      const params = toPageSearchParams(p);
      expect(params.category).toBe("bridal");
      expect(params.color).toBe("Pink");
    });

    it("returns an array for repeated keys", () => {
      const p = new URLSearchParams();
      p.append("size", "a:8");
      p.append("size", "k:10");
      const params = toPageSearchParams(p);
      expect(params.size).toEqual(["a:8", "k:10"]);
    });

    it("omits keys that are not in the URL", () => {
      const p = new URLSearchParams("category=bridal");
      const params = toPageSearchParams(p);
      expect(params.color).toBeUndefined();
      expect(params.page).toBeUndefined();
    });

    it("ignores unknown params", () => {
      const p = new URLSearchParams("foo=bar");
      const params = toPageSearchParams(p);
      expect("foo" in params).toBe(false);
    });

    it("extracts page param", () => {
      const p = new URLSearchParams("page=3");
      const params = toPageSearchParams(p);
      expect(params.page).toBe("3");
    });
  });
});
