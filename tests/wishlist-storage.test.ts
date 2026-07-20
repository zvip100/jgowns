import { describe, expect, it, vi } from "vitest";

import {
  addWishlistItem,
  applyWishlistStatusRefresh,
  parseWishlistStorage,
  removeWishlistItem,
  serializeWishlistStorage,
  sortWishlistItems,
} from "@/lib/wishlist-storage";
import { WISHLIST_MAX_ITEMS, WISHLIST_STORAGE_VERSION } from "@/lib/types";

import type { WishlistItem, WishlistStatusEntry } from "@/lib/types";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";
const ID_C = "33333333-3333-3333-3333-333333333333";

function makeItem(
  listingId: string,
  overrides: Partial<WishlistItem> = {},
): WishlistItem {
  return {
    listingId,
    addedAt: "2026-07-01T00:00:00.000Z",
    status: "active",
    snapshot: {
      title: "Test Gown",
      priceLabel: "$400",
      image: "https://example.com/a.jpg",
      blurDataUrl: null,
    },
    ...overrides,
  };
}

describe("parseWishlistStorage", () => {
  it("returns an empty value for null input", () => {
    expect(parseWishlistStorage(null)).toEqual({
      version: WISHLIST_STORAGE_VERSION,
      items: [],
    });
  });

  it("returns an empty value for unparseable JSON and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage("{not json");

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, items: [] });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns an empty value for a foreign shape and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage(JSON.stringify({ foo: "bar" }));

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, items: [] });
    warn.mockRestore();
  });

  it("returns an empty value for a mismatched version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage(
      JSON.stringify({ version: 999, items: [] }),
    );

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, items: [] });
    warn.mockRestore();
  });

  it("returns an empty value when an item has an invalid listingId", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const badItem = { ...makeItem(ID_A), listingId: "not-a-uuid" };

    const result = parseWishlistStorage(
      JSON.stringify({ version: WISHLIST_STORAGE_VERSION, items: [badItem] }),
    );

    expect(result.items).toEqual([]);
    warn.mockRestore();
  });

  it("returns an empty value when an item snapshot is missing fields", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const badItem = { ...makeItem(ID_A), snapshot: { title: "Only title" } };

    const result = parseWishlistStorage(
      JSON.stringify({ version: WISHLIST_STORAGE_VERSION, items: [badItem] }),
    );

    expect(result.items).toEqual([]);
    warn.mockRestore();
  });

  it("returns the parsed value for well-formed data", () => {
    const item = makeItem(ID_A);

    const result = parseWishlistStorage(
      JSON.stringify({ version: WISHLIST_STORAGE_VERSION, items: [item] }),
    );

    expect(result).toEqual({
      version: WISHLIST_STORAGE_VERSION,
      items: [item],
    });
  });
});

describe("serializeWishlistStorage", () => {
  it("round-trips through parseWishlistStorage", () => {
    const value = { version: WISHLIST_STORAGE_VERSION, items: [makeItem(ID_A)] };

    const result = parseWishlistStorage(serializeWishlistStorage(value));

    expect(result).toEqual(value);
  });
});

describe("sortWishlistItems", () => {
  it("orders items newest-first by addedAt", () => {
    const older = makeItem(ID_A, { addedAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeItem(ID_B, { addedAt: "2026-06-01T00:00:00.000Z" });

    const result = sortWishlistItems([older, newer]);

    expect(result.map((i) => i.listingId)).toEqual([ID_B, ID_A]);
  });

  it("does not mutate the input array", () => {
    const items = [makeItem(ID_A), makeItem(ID_B)];
    const original = [...items];

    sortWishlistItems(items);

    expect(items).toEqual(original);
  });
});

describe("addWishlistItem", () => {
  it("adds a new item", () => {
    const result = addWishlistItem([], makeItem(ID_A));

    expect(result.error).toBeNull();
    expect(result.items).toEqual([makeItem(ID_A)]);
  });

  it("is a no-op when the id is already saved", () => {
    const existing = [makeItem(ID_A)];

    const result = addWishlistItem(
      existing,
      makeItem(ID_A, { addedAt: "2026-12-01T00:00:00.000Z" }),
    );

    expect(result.error).toBeNull();
    expect(result.items).toBe(existing);
  });

  it("rejects without evicting once the cap is reached", () => {
    const full = Array.from({ length: WISHLIST_MAX_ITEMS }, (_, i) =>
      makeItem(`item-${i}`),
    );

    const result = addWishlistItem(full, makeItem(ID_A));

    expect(result.error).toBeTruthy();
    expect(result.items).toBe(full);
    expect(result.items).toHaveLength(WISHLIST_MAX_ITEMS);
  });
});

describe("removeWishlistItem", () => {
  it("removes a saved item", () => {
    const result = removeWishlistItem([makeItem(ID_A), makeItem(ID_B)], ID_A);

    expect(result.map((i) => i.listingId)).toEqual([ID_B]);
  });

  it("is a no-op when the id isn't saved", () => {
    const items = [makeItem(ID_A)];

    const result = removeWishlistItem(items, ID_B);

    expect(result).toEqual(items);
  });
});

describe("applyWishlistStatusRefresh", () => {
  it("updates status and snapshot for ids present in the response", () => {
    const items = [makeItem(ID_A, { status: "active" })];
    const entry: WishlistStatusEntry = {
      id: ID_A,
      status: "sold",
      snapshot: {
        title: "Updated Title",
        priceLabel: "$350",
        image: "https://example.com/b.jpg",
        blurDataUrl: "data:image/webp;base64,abc",
      },
    };

    const result = applyWishlistStatusRefresh(
      items,
      new Map([[ID_A, entry]]),
    );

    expect(result).toEqual([
      { ...items[0], status: "sold", snapshot: entry.snapshot },
    ]);
  });

  it("marks ids absent from the response as unavailable, keeping their snapshot", () => {
    const items = [makeItem(ID_C, { status: "active" })];

    const result = applyWishlistStatusRefresh(items, new Map());

    expect(result).toEqual([{ ...items[0], status: "unavailable" }]);
  });
});
