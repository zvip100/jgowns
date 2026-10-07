import { describe, expect, it } from "vitest";

import { MIN_COVER_KEEP, keepsEnoughForCover } from "@/lib/images/cover-rule";

describe("MIN_COVER_KEEP", () => {
  it("is 85%", () => {
    expect(MIN_COVER_KEEP).toBe(0.85);
  });
});

describe("keepsEnoughForCover", () => {
  it("keeps 3:4, 4:5 and 2:3, the shapes the pipeline already cropped", () => {
    expect(keepsEnoughForCover(1200, 1600)).toBe(true);
    expect(keepsEnoughForCover(1200, 1500)).toBe(true);
    expect(keepsEnoughForCover(1000, 1500)).toBe(true);
  });

  it("letterboxes square, landscape and very tall shots", () => {
    expect(keepsEnoughForCover(1000, 1000)).toBe(false);
    expect(keepsEnoughForCover(1600, 1200)).toBe(false);
    expect(keepsEnoughForCover(780, 2000)).toBe(false);
  });

  it("draws the line at exactly 85% kept, on both sides of 3:4", () => {
    // Narrower than 3:4: kept = ratio / 0.75.
    expect(keepsEnoughForCover(0.6375 * 1000, 1000)).toBe(true);
    expect(keepsEnoughForCover(0.637 * 1000, 1000)).toBe(false);
    // Wider than 3:4: kept = 0.75 / ratio.
    expect(keepsEnoughForCover(882, 1000)).toBe(true);
    expect(keepsEnoughForCover(883, 1000)).toBe(false);
  });
});
