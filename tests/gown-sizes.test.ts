import { describe, expect, it } from "vitest";

import {
  decodeSizeFilterToken,
  encodeSizeFilterToken,
  getSizeFilterOptions,
  getSizeOptionsForCategory,
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
});
