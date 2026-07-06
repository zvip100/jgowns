import { describe, expect, it } from "vitest";

import {
  decodeSizeFilterToken,
  encodeSizeFilterToken,
  findSizeOption,
  getBrowseAllowedSizes,
  getSizeFilterOptions,
  getSizeOptionsForCategory,
  getSizeSelectGroups,
  isAdultGownCategory,
  isValidSizeForCategory,
  isValidSizePair,
  sizeOptionIndex,
} from "@/lib/gown-sizes";

describe("gown-sizes", () => {
  it("uses unique filter tokens per size group", () => {
    const options = getSizeFilterOptions(null);
    const tokens = options.map((o) => o.filterToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens).toContain("a:8");
    expect(tokens).toContain("k:8");
    expect(tokens).not.toEqual(expect.arrayContaining(["8"]));
  });

  it("round-trips encode/decode for all prefixes", () => {
    const samples = [
      ["toddler", "8T"],
      ["kids", "8"],
      ["junior", "J10"],
      ["adult", "12"],
    ] as const;

    for (const [group, size] of samples) {
      const token = encodeSizeFilterToken(group, size);
      expect(decodeSizeFilterToken(token)).toEqual({
        sizeGroup: group,
        size,
      });
    }
  });

  it("rejects invalid or aliased tokens", () => {
    expect(decodeSizeFilterToken("8")).toBeNull();
    expect(decodeSizeFilterToken("adult:8")).toBeNull();
    expect(decodeSizeFilterToken("x:8")).toBeNull();
  });

  it("includes full adult formal grid for girls", () => {
    const adultSizes = getSizeOptionsForCategory("girls")
      .filter((o) => o.sizeGroup === "adult")
      .map((o) => o.value);
    expect(adultSizes).toContain("0");
    expect(adultSizes).toContain("6");
    expect(adultSizes).toContain("8");
    expect(adultSizes).toContain("36");
    expect(adultSizes.length).toBe(19);
  });

  describe("getSizeOptionsForCategory", () => {
    it("bridal has only junior and adult groups (26 options)", () => {
      const options = getSizeOptionsForCategory("bridal");
      const groups = [...new Set(options.map((o) => o.sizeGroup))];
      expect(groups).toEqual(["junior", "adult"]);
      expect(options.length).toBe(26);
    });

    it("mother-of-the-bride matches bridal size groups", () => {
      const motb = getSizeOptionsForCategory("mother-of-the-bride");
      const bridal = getSizeOptionsForCategory("bridal");
      expect(motb.map((o) => o.value)).toEqual(bridal.map((o) => o.value));
    });

    it("women matches bridal size groups", () => {
      const women = getSizeOptionsForCategory("women");
      const bridal = getSizeOptionsForCategory("bridal");
      expect(women.map((o) => o.value)).toEqual(bridal.map((o) => o.value));
    });

    it("maternity matches bridal size groups", () => {
      const maternity = getSizeOptionsForCategory("maternity");
      const bridal = getSizeOptionsForCategory("bridal");
      expect(maternity.map((o) => o.value)).toEqual(bridal.map((o) => o.value));
    });

    it("girls has all four groups (44 options)", () => {
      const options = getSizeOptionsForCategory("girls");
      const groups = [...new Set(options.map((o) => o.sizeGroup))];
      expect(groups).toEqual(["toddler", "kids", "junior", "adult"]);
      expect(options.length).toBe(44);
    });

    it("girls toddler group has 9 sizes (2T–10T)", () => {
      const toddler = getSizeOptionsForCategory("girls")
        .filter((o) => o.sizeGroup === "toddler")
        .map((o) => o.value);
      expect(toddler).toContain("2T");
      expect(toddler).toContain("10T");
      expect(toddler.length).toBe(9);
    });

    it("girls kids group has 9 sizes", () => {
      const kids = getSizeOptionsForCategory("girls")
        .filter((o) => o.sizeGroup === "kids")
        .map((o) => o.value);
      expect(kids).toContain("3");
      expect(kids).toContain("16");
      expect(kids.length).toBe(9);
    });

    it("junior group has 7 sizes (J6–J18)", () => {
      const junior = getSizeOptionsForCategory("bridal")
        .filter((o) => o.sizeGroup === "junior")
        .map((o) => o.value);
      expect(junior).toContain("J6");
      expect(junior).toContain("J18");
      expect(junior.length).toBe(7);
    });
  });

  describe("isAdultGownCategory", () => {
    it("returns true for adult-only categories", () => {
      expect(isAdultGownCategory("bridal")).toBe(true);
      expect(isAdultGownCategory("mother-of-the-bride")).toBe(true);
      expect(isAdultGownCategory("women")).toBe(true);
      expect(isAdultGownCategory("maternity")).toBe(true);
    });

    it("returns false for girls", () => {
      expect(isAdultGownCategory("girls")).toBe(false);
    });
  });

  describe("isValidSizePair", () => {
    it("returns true for valid size+group combos", () => {
      expect(isValidSizePair("bridal", "junior", "J10")).toBe(true);
      expect(isValidSizePair("bridal", "adult", "8")).toBe(true);
      expect(isValidSizePair("girls", "toddler", "4T")).toBe(true);
      expect(isValidSizePair("girls", "kids", "8")).toBe(true);
      expect(isValidSizePair("girls", "adult", "0")).toBe(true);
    });

    it("returns false when the group is not available for the category", () => {
      expect(isValidSizePair("bridal", "toddler", "4T")).toBe(false);
      expect(isValidSizePair("bridal", "kids", "8")).toBe(false);
      expect(isValidSizePair("women", "toddler", "2T")).toBe(false);
    });

    it("returns false for a nonexistent size within a valid group", () => {
      expect(isValidSizePair("bridal", "adult", "99")).toBe(false);
      expect(isValidSizePair("girls", "junior", "J99")).toBe(false);
    });
  });

  describe("isValidSizeForCategory", () => {
    it("is an alias for isValidSizePair", () => {
      expect(isValidSizeForCategory("girls", "kids", "8")).toBe(
        isValidSizePair("girls", "kids", "8"),
      );
      expect(isValidSizeForCategory("bridal", "toddler", "4T")).toBe(
        isValidSizePair("bridal", "toddler", "4T"),
      );
    });
  });

  describe("findSizeOption", () => {
    it("returns the matching SizeOption", () => {
      const opt = findSizeOption("girls", "kids", "8");
      expect(opt).toBeDefined();
      expect(opt?.sizeGroup).toBe("kids");
      expect(opt?.value).toBe("8");
      expect(opt?.filterToken).toBe("k:8");
    });

    it("returns undefined when the group is not available for the category", () => {
      expect(findSizeOption("bridal", "toddler", "4T")).toBeUndefined();
    });

    it("returns undefined for an invalid size within a valid group", () => {
      expect(findSizeOption("bridal", "adult", "99")).toBeUndefined();
    });

    it("returns correct filterToken for adult sizes", () => {
      const opt = findSizeOption("bridal", "adult", "12");
      expect(opt?.filterToken).toBe("a:12");
    });
  });

  describe("getSizeFilterOptions", () => {
    it("returns all 44 options for no category", () => {
      expect(getSizeFilterOptions(null).length).toBe(44);
      expect(getSizeFilterOptions(undefined).length).toBe(44);
    });

    it("returns only the category's options when a category is given", () => {
      const bridal = getSizeFilterOptions("bridal");
      expect(bridal.length).toBe(26);
      expect(bridal.every((o) => ["junior", "adult"].includes(o.sizeGroup))).toBe(
        true,
      );
    });
  });

  describe("getBrowseAllowedSizes", () => {
    it("returns all filter tokens when no category is given", () => {
      const tokens = getBrowseAllowedSizes(undefined);
      expect(tokens).toContain("t:2T");
      expect(tokens).toContain("k:8");
      expect(tokens).toContain("j:J10");
      expect(tokens).toContain("a:8");
      expect(tokens.length).toBe(44);
    });

    it("returns only valid tokens for bridal (junior + adult)", () => {
      const tokens = getBrowseAllowedSizes("bridal");
      expect(tokens).toContain("j:J10");
      expect(tokens).toContain("a:8");
      expect(tokens).not.toContain("t:2T");
      expect(tokens).not.toContain("k:8");
      expect(tokens.length).toBe(26);
    });

    it("returns all four groups for girls", () => {
      const tokens = getBrowseAllowedSizes("girls");
      expect(tokens).toContain("t:4T");
      expect(tokens).toContain("k:8");
      expect(tokens).toContain("j:J10");
      expect(tokens).toContain("a:8");
      expect(tokens.length).toBe(44);
    });
  });

  describe("getSizeSelectGroups", () => {
    it("returns two groups for bridal: Junior and Adult formal", () => {
      const groups = getSizeSelectGroups("bridal");
      const labels = groups.map((g) => g.label);
      expect(labels).toEqual(["Junior", "Adult formal"]);
    });

    it("returns four groups for girls", () => {
      const groups = getSizeSelectGroups("girls");
      const labels = groups.map((g) => g.label);
      expect(labels).toEqual(["Toddler", "Kids", "Junior", "Adult formal"]);
    });

    it("each group contains options with correct sizeGroup", () => {
      const groups = getSizeSelectGroups("girls");
      const toddlerGroup = groups.find((g) => g.label === "Toddler");
      expect(toddlerGroup?.options.every((o) => o.sizeGroup === "toddler")).toBe(
        true,
      );
    });

    it("adult formal group has 19 options for bridal", () => {
      const groups = getSizeSelectGroups("bridal");
      const adultGroup = groups.find((g) => g.label === "Adult formal");
      expect(adultGroup?.options.length).toBe(19);
    });
  });

  describe("sizeOptionIndex", () => {
    it("orders sizes by their canonical category position", () => {
      const size8 = sizeOptionIndex("bridal", "adult", "8");
      const size10 = sizeOptionIndex("bridal", "adult", "10");
      const junior = sizeOptionIndex("bridal", "junior", "J10");
      expect(size8).toBeLessThan(size10);
      expect(junior).toBeLessThan(size8);
    });

    it("returns -1 for a size that is not valid in the category", () => {
      expect(sizeOptionIndex("bridal", "kids", "8")).toBe(-1);
    });
  });
});
