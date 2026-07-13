import { describe, expect, it } from "vitest";

import {
  availableSizes,
  formatPrice,
  isListingSoldOut,
  listingBundleNote,
  listingPriceSummary,
  listingSizeSummary,
  sortListingSizes,
} from "@/lib/listing-variants";

import type { ListingSize, ListingWithSizes, SellMode } from "@/lib/types";

let sizeCounter = 0;

function makeSize(overrides: Partial<ListingSize> = {}): ListingSize {
  sizeCounter++;
  return {
    id: `size-${sizeCounter}`,
    listing_id: "listing-1",
    size: "8",
    size_group: "adult",
    price: 400,
    status: "available",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeListing(
  sizes: ListingSize[],
  overrides: Partial<ListingWithSizes> = {},
): ListingWithSizes {
  return {
    id: "listing-1",
    user_id: "user-1",
    title: "Gown",
    description: null,
    color: null,
    location: null,
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual" as SellMode,
    bundle_price: null,
    image_urls: [],
    image_blur_data_urls: [],
    contact_email: "a@b.com",
    contact_phone: null,
    contact_methods: [],
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    sizes,
    ...overrides,
  };
}

describe("formatPrice", () => {
  it("formats with a dollar sign and thousands separators", () => {
    expect(formatPrice(400)).toBe("$400");
    expect(formatPrice(1150)).toBe("$1,150");
  });
});

describe("sortListingSizes", () => {
  it("orders by sort_order, then size numerically", () => {
    const sizes = [
      makeSize({ size: "12", sort_order: 1 }),
      makeSize({ size: "10", sort_order: 1 }),
      makeSize({ size: "8", sort_order: 0 }),
    ];
    expect(sortListingSizes(sizes).map((s) => s.size)).toEqual([
      "8",
      "10",
      "12",
    ]);
  });

  it("does not mutate the input array", () => {
    const sizes = [makeSize({ sort_order: 1 }), makeSize({ sort_order: 0 })];
    const copy = [...sizes];
    sortListingSizes(sizes);
    expect(sizes).toEqual(copy);
  });
});

describe("availableSizes", () => {
  it("keeps only available variants", () => {
    const avail = makeSize();
    const sold = makeSize({ status: "sold" });
    expect(availableSizes([avail, sold])).toEqual([avail]);
  });
});

describe("listingSizeSummary", () => {
  it("returns `Size X` for a single available variant", () => {
    expect(listingSizeSummary(makeListing([makeSize({ size: "8" })]))).toBe(
      "Size 8",
    );
  });

  it("lists available variants only, in order", () => {
    const listing = makeListing([
      makeSize({ size: "12", sort_order: 2 }),
      makeSize({ size: "8", sort_order: 0 }),
      makeSize({ size: "10", sort_order: 1, status: "sold" }),
    ]);
    expect(listingSizeSummary(listing)).toBe("Sizes 8, 12");
  });

  it("falls back to all variants when everything is sold", () => {
    const listing = makeListing([
      makeSize({ size: "8", status: "sold" }),
      makeSize({ size: "10", status: "sold", sort_order: 1 }),
    ]);
    expect(listingSizeSummary(listing)).toBe("Sizes 8, 10");
  });

  it("returns an empty string with no variants", () => {
    expect(listingSizeSummary(makeListing([]))).toBe("");
  });
});

describe("listingPriceSummary", () => {
  it("returns the single price for one variant", () => {
    expect(listingPriceSummary(makeListing([makeSize({ price: 425 })]))).toBe(
      "$425",
    );
  });

  it("returns `$X each` when all available variants share a price", () => {
    const listing = makeListing([
      makeSize({ size: "8", price: 425 }),
      makeSize({ size: "10", price: 425 }),
    ]);
    expect(listingPriceSummary(listing)).toBe("$425 each");
  });

  it("returns `From $X` for mixed prices", () => {
    const listing = makeListing([
      makeSize({ size: "8", price: 400 }),
      makeSize({ size: "10", price: 425 }),
    ]);
    expect(listingPriceSummary(listing)).toBe("From $400");
  });

  it("ignores sold variants when deriving the summary", () => {
    const listing = makeListing([
      makeSize({ size: "8", price: 400, status: "sold" }),
      makeSize({ size: "10", price: 425 }),
    ]);
    expect(listingPriceSummary(listing)).toBe("$425");
  });

  it("uses the bundle price for set_only listings", () => {
    const listing = makeListing(
      [makeSize({ price: 400 }), makeSize({ size: "10", price: 425 })],
      { sell_mode: "set_only", bundle_price: 1150 },
    );
    expect(listingPriceSummary(listing)).toBe("$1,150");
  });

  it("falls back to per-size prices for set_only with no bundle price", () => {
    const listing = makeListing(
      [
        makeSize({ price: 400 }),
        makeSize({ size: "10", price: 425 }),
      ],
      { sell_mode: "set_only", bundle_price: null },
    );
    expect(listingPriceSummary(listing)).toBe("From $400");
  });

  it("returns an empty string with no variants", () => {
    expect(listingPriceSummary(makeListing([]))).toBe("");
  });
});

describe("listingBundleNote", () => {
  it("returns `All for $X` for either-mode listings with 2+ available sizes", () => {
    const listing = makeListing(
      [makeSize(), makeSize({ size: "10" })],
      { sell_mode: "either", bundle_price: 1150 },
    );
    expect(listingBundleNote(listing)).toBe("All for $1,150");
  });

  it("returns null for either-mode once only one size remains", () => {
    const listing = makeListing(
      [makeSize(), makeSize({ size: "10", status: "sold" })],
      { sell_mode: "either", bundle_price: 1150 },
    );
    expect(listingBundleNote(listing)).toBeNull();
  });

  it("returns `Complete set only` for set_only listings", () => {
    const listing = makeListing([makeSize()], {
      sell_mode: "set_only",
      bundle_price: 1150,
    });
    expect(listingBundleNote(listing)).toBe("Complete set only");
  });

  it("returns null without a bundle price", () => {
    expect(listingBundleNote(makeListing([makeSize()]))).toBeNull();
  });
});

describe("isListingSoldOut", () => {
  it("is sold out when the listing status is sold", () => {
    const listing = makeListing([makeSize()], { status: "sold" });
    expect(isListingSoldOut(listing)).toBe(true);
  });

  it("is not sold out for removed listings (handled separately)", () => {
    const listing = makeListing([makeSize({ status: "sold" })], {
      status: "removed",
    });
    expect(isListingSoldOut(listing)).toBe(false);
  });

  it("is sold out when every variant of an active individual listing is sold", () => {
    const listing = makeListing([
      makeSize({ status: "sold" }),
      makeSize({ size: "10", status: "sold" }),
    ]);
    expect(isListingSoldOut(listing)).toBe(true);
  });

  it("is available while at least one variant remains", () => {
    const listing = makeListing([
      makeSize({ status: "sold" }),
      makeSize({ size: "10" }),
    ]);
    expect(isListingSoldOut(listing)).toBe(false);
  });

  it("ignores variant status for set_only listings (listing status governs)", () => {
    const listing = makeListing(
      [makeSize({ status: "sold" }), makeSize({ size: "10", status: "sold" })],
      { sell_mode: "set_only", bundle_price: 900 },
    );
    expect(isListingSoldOut(listing)).toBe(false);
  });

  it("is not sold out with no variants", () => {
    expect(isListingSoldOut(makeListing([]))).toBe(false);
  });
});
