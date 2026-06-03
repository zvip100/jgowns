import { describe, expect, it } from "vitest";

import { hasBrowseFilters, parseBrowseFilters } from "@/lib/browse-filters";
import type { BrowseFilters } from "@/lib/types";

describe("browse-filters", () => {
  describe("parseBrowseFilters", () => {
    it("returns all-undefined for empty params", () => {
      const filters = parseBrowseFilters({});
      expect(filters.category).toBeUndefined();
      expect(filters.size).toBeUndefined();
      expect(filters.color).toBeUndefined();
      expect(filters.location).toBeUndefined();
      expect(filters.cond).toBeUndefined();
      expect(filters.minPrice).toBeUndefined();
      expect(filters.maxPrice).toBeUndefined();
    });

    describe("category", () => {
      it("accepts a valid category", () => {
        expect(parseBrowseFilters({ category: "bridal" }).category).toBe("bridal");
        expect(parseBrowseFilters({ category: "girls" }).category).toBe("girls");
        expect(parseBrowseFilters({ category: "mother-of-the-bride" }).category).toBe(
          "mother-of-the-bride",
        );
      });

      it("rejects an invalid category", () => {
        expect(parseBrowseFilters({ category: "invalid" }).category).toBeUndefined();
        expect(parseBrowseFilters({ category: "" }).category).toBeUndefined();
      });

      it("uses the first value when given an array", () => {
        expect(
          parseBrowseFilters({ category: ["bridal", "girls"] }).category,
        ).toBe("bridal");
      });
    });

    describe("size", () => {
      it("accepts valid size tokens for the given category", () => {
        const filters = parseBrowseFilters({ category: "bridal", size: "a:8" });
        expect(filters.size).toContain("a:8");
      });

      it("rejects size tokens that are invalid for the category", () => {
        // bridal only allows junior + adult; toddler tokens are not valid
        const filters = parseBrowseFilters({ category: "bridal", size: "t:2T" });
        expect(filters.size).toBeUndefined();
      });

      it("accepts multiple valid size tokens (comma-separated)", () => {
        const filters = parseBrowseFilters({
          category: "girls",
          size: "k:8,t:4T",
        });
        expect(filters.size).toContain("k:8");
        expect(filters.size).toContain("t:4T");
      });

      it("accepts any valid token when no category is set", () => {
        const filters = parseBrowseFilters({ size: "t:2T" });
        expect(filters.size).toContain("t:2T");
      });

      it("filters out invalid tokens when mixed with valid ones", () => {
        // bridal: only junior + adult allowed
        const filters = parseBrowseFilters({
          category: "bridal",
          size: "a:8,t:2T",
        });
        expect(filters.size).toContain("a:8");
        expect(filters.size).not.toContain("t:2T");
      });

      it("returns undefined when all tokens are invalid for the category", () => {
        const filters = parseBrowseFilters({ category: "bridal", size: "t:2T,k:8" });
        expect(filters.size).toBeUndefined();
      });
    });

    describe("color", () => {
      it("accepts a valid color", () => {
        expect(parseBrowseFilters({ color: "Ivory" }).color).toEqual(["Ivory"]);
      });

      it("accepts multiple valid colors", () => {
        const filters = parseBrowseFilters({ color: "Ivory,White" });
        expect(filters.color).toEqual(["Ivory", "White"]);
      });

      it("rejects an invalid color", () => {
        expect(parseBrowseFilters({ color: "Rainbow" }).color).toBeUndefined();
      });

      it("filters out invalid colors when mixed with valid ones", () => {
        const filters = parseBrowseFilters({ color: "Ivory,Rainbow" });
        expect(filters.color).toEqual(["Ivory"]);
      });
    });

    describe("location", () => {
      it("accepts a valid location", () => {
        expect(parseBrowseFilters({ location: "Monsey" }).location).toEqual([
          "Monsey",
        ]);
      });

      it("accepts multiple valid locations", () => {
        const filters = parseBrowseFilters({ location: "Monsey,Lakewood" });
        expect(filters.location).toEqual(["Monsey", "Lakewood"]);
      });

      it("rejects an invalid location", () => {
        expect(parseBrowseFilters({ location: "Tokyo" }).location).toBeUndefined();
      });
    });

    describe("cond", () => {
      it("accepts valid cond values", () => {
        expect(parseBrowseFilters({ cond: "Brand New" }).cond).toBe("Brand New");
        expect(parseBrowseFilters({ cond: "no-alterations" }).cond).toBe(
          "no-alterations",
        );
      });

      it("rejects cond values not in the browse allowlist", () => {
        // "Needs Alterations" is a DB condition but not a browse filter value
        expect(parseBrowseFilters({ cond: "Needs Alterations" }).cond).toBeUndefined();
        expect(parseBrowseFilters({ cond: "Perfect Condition" }).cond).toBeUndefined();
      });
    });

    describe("minPrice / maxPrice", () => {
      it("parses valid numeric prices", () => {
        const filters = parseBrowseFilters({ minPrice: "100", maxPrice: "500" });
        expect(filters.minPrice).toBe(100);
        expect(filters.maxPrice).toBe(500);
      });

      it("parses decimal prices", () => {
        expect(parseBrowseFilters({ minPrice: "99.99" }).minPrice).toBe(99.99);
      });

      it("returns undefined for non-numeric values", () => {
        expect(parseBrowseFilters({ minPrice: "abc" }).minPrice).toBeUndefined();
        expect(parseBrowseFilters({ maxPrice: "" }).maxPrice).toBeUndefined();
      });

      it("parses zero as a valid price", () => {
        expect(parseBrowseFilters({ minPrice: "0" }).minPrice).toBe(0);
      });
    });
  });

  describe("hasBrowseFilters", () => {
    it("returns false for a completely empty filter object", () => {
      expect(hasBrowseFilters({})).toBe(false);
    });

    it("returns true when category is set", () => {
      expect(hasBrowseFilters({ category: "bridal" })).toBe(true);
    });

    it("returns true when size has entries", () => {
      expect(hasBrowseFilters({ size: ["a:8"] })).toBe(true);
    });

    it("returns false when size is an empty array", () => {
      expect(hasBrowseFilters({ size: [] })).toBe(false);
    });

    it("returns true when color has entries", () => {
      expect(hasBrowseFilters({ color: ["Ivory"] })).toBe(true);
    });

    it("returns true when location has entries", () => {
      expect(hasBrowseFilters({ location: ["Monsey"] })).toBe(true);
    });

    it("returns true when cond is set", () => {
      expect(hasBrowseFilters({ cond: "Brand New" })).toBe(true);
    });

    it("returns true when minPrice is set", () => {
      expect(hasBrowseFilters({ minPrice: 100 })).toBe(true);
    });

    it("returns true when maxPrice is set", () => {
      expect(hasBrowseFilters({ maxPrice: 500 })).toBe(true);
    });

    it("returns true when minPrice is 0", () => {
      expect(hasBrowseFilters({ minPrice: 0 })).toBe(true);
    });
  });
});
