import { describe, expect, it } from "vitest";

import {
  capitalizeWords,
  cn,
  digitsOnlyPhone,
  firstParam,
  formatPhoneDisplay,
  optionalPhoneSchema,
} from "@/lib/utils";

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

  describe("capitalizeWords", () => {
    it("capitalizes each lowercase word", () => {
      expect(capitalizeWords("vera wang ball gown")).toBe("Vera Wang Ball Gown");
    });

    it("preserves the rest of each word as typed", () => {
      expect(capitalizeWords("mcQueen gown")).toBe("McQueen Gown");
      expect(capitalizeWords("LBD")).toBe("LBD");
      expect(capitalizeWords("iVORY lace")).toBe("IVORY Lace");
    });

    it("keeps original spacing between words", () => {
      expect(capitalizeWords("ivory   lace\tgown")).toBe("Ivory   Lace\tGown");
      expect(capitalizeWords("  ivory ")).toBe("  Ivory ");
    });

    it("leaves already capitalized text unchanged", () => {
      expect(capitalizeWords("Vera Wang Ball Gown")).toBe("Vera Wang Ball Gown");
    });

    it("capitalizes a single word", () => {
      expect(capitalizeWords("gown")).toBe("Gown");
    });

    it("leaves words starting with digits or punctuation as is", () => {
      expect(capitalizeWords("2 piece set (ivory)")).toBe("2 Piece Set (ivory)");
      expect(capitalizeWords("a-line gown, size 8")).toBe("A-line Gown, Size 8");
    });

    it("returns an empty string unchanged", () => {
      expect(capitalizeWords("")).toBe("");
    });
  });

  describe("digitsOnlyPhone", () => {
    it("keeps digits and strips everything else", () => {
      expect(digitsOnlyPhone("(555) 123-4567")).toBe("5551234567");
      expect(digitsOnlyPhone("555abc123")).toBe("555123");
      expect(digitsOnlyPhone("+1 555.123.4567")).toBe("15551234567");
    });

    it("returns an empty string for blank / null / undefined", () => {
      expect(digitsOnlyPhone("")).toBe("");
      expect(digitsOnlyPhone(null)).toBe("");
      expect(digitsOnlyPhone(undefined)).toBe("");
    });
  });

  describe("formatPhoneDisplay", () => {
    it("formats a 10-digit number as (XXX) XXX-XXXX", () => {
      expect(formatPhoneDisplay("5551234567")).toBe("(555) 123-4567");
    });

    it("strips formatting before formatting a 10-digit number", () => {
      expect(formatPhoneDisplay("555.123.4567")).toBe("(555) 123-4567");
    });

    it("returns the input unchanged when it is not 10 digits", () => {
      expect(formatPhoneDisplay("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
      expect(formatPhoneDisplay("12345")).toBe("12345");
      expect(formatPhoneDisplay("")).toBe("");
    });
  });

  describe("optionalPhoneSchema", () => {
    it("treats blank / undefined / whitespace as undefined", () => {
      expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
      expect(optionalPhoneSchema.parse("")).toBeUndefined();
      expect(optionalPhoneSchema.parse("   ")).toBeUndefined();
    });

    it("normalizes a formatted number to digits only", () => {
      expect(optionalPhoneSchema.parse("+1 (555) 123-4567")).toBe("15551234567");
      expect(optionalPhoneSchema.parse("555-123-4567")).toBe("5551234567");
    });

    it("rejects values containing letters instead of stripping them", () => {
      expect(optionalPhoneSchema.safeParse("555-CALL-NOW").success).toBe(false);
      expect(optionalPhoneSchema.safeParse("abc").success).toBe(false);
      expect(optionalPhoneSchema.safeParse("123abc4567").success).toBe(false);
    });

    it("rejects too-short and too-long digit counts", () => {
      expect(optionalPhoneSchema.safeParse("12345").success).toBe(false);
      expect(optionalPhoneSchema.safeParse("1234567890123456").success).toBe(false);
    });

    it("rejects formatting with no digits", () => {
      expect(optionalPhoneSchema.safeParse("()-+").success).toBe(false);
    });
  });
});
