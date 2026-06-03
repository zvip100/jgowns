import { describe, expect, it } from "vitest";

import { browseHref, browseHrefFromBack, browseQueryString } from "@/lib/browse-url";
import type { BrowseFilters } from "@/lib/types";

describe("browse-url", () => {
  describe("browseQueryString", () => {
    it("returns empty string for empty filters", () => {
      expect(browseQueryString({})).toBe("");
    });

    it("encodes category", () => {
      const qs = browseQueryString({ category: "bridal" });
      expect(new URLSearchParams(qs).get("category")).toBe("bridal");
    });

    it("encodes multiple colors as a comma-separated value", () => {
      const qs = browseQueryString({ color: ["Ivory", "White"] });
      const params = new URLSearchParams(qs);
      expect(params.get("color")).toBe("Ivory,White");
    });

    it("encodes minPrice and maxPrice", () => {
      const qs = browseQueryString({ minPrice: 100, maxPrice: 500 });
      const params = new URLSearchParams(qs);
      expect(params.get("minPrice")).toBe("100");
      expect(params.get("maxPrice")).toBe("500");
    });

    it("omits page when page is 1", () => {
      const qs = browseQueryString({ category: "bridal" }, 1);
      expect(new URLSearchParams(qs).get("page")).toBeNull();
    });

    it("includes page when page is greater than 1", () => {
      const qs = browseQueryString({ category: "bridal" }, 3);
      expect(new URLSearchParams(qs).get("page")).toBe("3");
    });

    it("puts category before filter params in the query string", () => {
      const qs = browseQueryString({ category: "girls", color: ["Ivory"] });
      expect(qs.indexOf("category")).toBeLessThan(qs.indexOf("color"));
    });

    it("encodes size tokens", () => {
      const qs = browseQueryString({ size: ["a:8", "k:10"] });
      const params = new URLSearchParams(qs);
      expect(params.get("size")).toBe("a:8,k:10");
    });
  });

  describe("browseHref", () => {
    it("returns /browse for empty filters", () => {
      expect(browseHref({})).toBe("/browse");
    });

    it("returns /browse for empty filters with page 1", () => {
      expect(browseHref({}, 1)).toBe("/browse");
    });

    it("returns /browse?... with filter params", () => {
      const href = browseHref({ category: "bridal" });
      expect(href).toBe("/browse?category=bridal");
    });

    it("includes page > 1 in the path", () => {
      const href = browseHref({ category: "bridal" }, 2);
      expect(href.startsWith("/browse?")).toBe(true);
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("page")).toBe("2");
    });

    it("builds a full multi-filter href", () => {
      const filters: BrowseFilters = {
        category: "girls",
        color: ["Ivory"],
        location: ["Monsey"],
        cond: "Brand New",
      };
      const href = browseHref(filters);
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("category")).toBe("girls");
      expect(params.get("color")).toBe("Ivory");
      expect(params.get("location")).toBe("Monsey");
      expect(params.get("cond")).toBe("Brand New");
    });
  });

  describe("browseHrefFromBack", () => {
    it("returns /browse for undefined", () => {
      expect(browseHrefFromBack(undefined)).toBe("/browse");
    });

    it("returns /browse for empty string", () => {
      expect(browseHrefFromBack("")).toBe("/browse");
    });

    it("returns /browse for whitespace-only string", () => {
      expect(browseHrefFromBack("   ")).toBe("/browse");
    });

    it("parses a bare query string", () => {
      const href = browseHrefFromBack("category=bridal");
      expect(href).toBe("/browse?category=bridal");
    });

    it("strips a leading ? before parsing", () => {
      const href = browseHrefFromBack("?category=bridal");
      expect(href).toBe("/browse?category=bridal");
    });

    it("strips the /browse? prefix before parsing", () => {
      const href = browseHrefFromBack("/browse?category=bridal");
      expect(href).toBe("/browse?category=bridal");
    });

    it("handles /browse with no query string", () => {
      expect(browseHrefFromBack("/browse")).toBe("/browse");
    });

    it("sanitizes invalid filter values (invalid category dropped)", () => {
      const href = browseHrefFromBack("category=invalid");
      expect(href).toBe("/browse");
    });

    it("sanitizes invalid color values", () => {
      const href = browseHrefFromBack("color=Rainbow");
      expect(href).toBe("/browse");
    });

    it("preserves valid filters and page", () => {
      const href = browseHrefFromBack("category=girls&color=Ivory&page=2");
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("category")).toBe("girls");
      expect(params.get("color")).toBe("Ivory");
      expect(params.get("page")).toBe("2");
    });

    it("drops page=1 from the resulting URL", () => {
      const href = browseHrefFromBack("category=bridal&page=1");
      const params = new URLSearchParams(href.replace("/browse?", ""));
      expect(params.get("page")).toBeNull();
    });

    it("drops unknown params", () => {
      const href = browseHrefFromBack("category=bridal&foo=bar");
      expect(href).toBe("/browse?category=bridal");
    });
  });
});
