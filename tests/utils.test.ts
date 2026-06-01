import { describe, expect, it } from "vitest";

import { cn, firstParam } from "@/lib/utils";

describe("utils", () => {
  describe("cn", () => {
    it("joins class names with a space", () => {
      expect(cn("a", "b", "c")).toBe("a b c");
    });

    it("omits falsy values", () => {
      expect(cn("a", undefined, false, null, "b")).toBe("a b");
    });

    it("resolves conflicting tailwind classes (last wins)", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
      expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("handles conditional object syntax", () => {
      expect(cn({ "font-bold": true, italic: false })).toBe("font-bold");
    });

    it("handles array syntax", () => {
      expect(cn(["a", "b"], "c")).toBe("a b c");
    });

    it("returns empty string for no valid classes", () => {
      expect(cn(undefined, false)).toBe("");
    });
  });

  describe("firstParam", () => {
    it("returns a string as-is", () => {
      expect(firstParam("hello")).toBe("hello");
    });

    it("returns the first element of an array", () => {
      expect(firstParam(["a", "b", "c"])).toBe("a");
    });

    it("returns undefined for undefined", () => {
      expect(firstParam(undefined)).toBeUndefined();
    });

    it("returns undefined for an empty array", () => {
      expect(firstParam([])).toBeUndefined();
    });
  });
});
