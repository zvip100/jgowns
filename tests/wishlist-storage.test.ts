import { describe, expect, it, vi } from "vitest";

import {
  addWishlistItem,
  applyWishlistStatusRefresh,
  parseWishlistStorage,
  planWishlistReconcile,
  reconcileMergeResult,
  removeWishlistItem,
  serializeWishlistStorage,
  sortWishlistItems,
  toWishlistMergePayload,
} from "@/lib/wishlist-storage";
import { WISHLIST_MAX_ITEMS, WISHLIST_STORAGE_VERSION } from "@/lib/types";

import type { WishlistItem, WishlistStatusEntry } from "@/lib/types";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";
const ID_C = "33333333-3333-3333-3333-333333333333";
const USER_ID = "99999999-9999-9999-9999-999999999999";
const OTHER_USER_ID = "88888888-8888-8888-8888-888888888888";

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
      ownerId: null,
      items: [],
    });
  });

  it("returns an empty value for unparseable JSON and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage("{not json");

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, ownerId: null, items: [] });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns an empty value for a foreign shape and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage(JSON.stringify({ foo: "bar" }));

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, ownerId: null, items: [] });
    warn.mockRestore();
  });

  it("returns an empty value for a mismatched version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = parseWishlistStorage(
      JSON.stringify({ version: 999, items: [] }),
    );

    expect(result).toEqual({ version: WISHLIST_STORAGE_VERSION, ownerId: null, items: [] });
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
      ownerId: null,
      items: [item],
    });
  });

  it("preserves a stored ownerId", () => {
    const result = parseWishlistStorage(
      JSON.stringify({
        version: WISHLIST_STORAGE_VERSION,
        ownerId: USER_ID,
        items: [makeItem(ID_A)],
      }),
    );

    expect(result.ownerId).toBe(USER_ID);
  });

  it("defaults ownerId to null when it is not a string", () => {
    const result = parseWishlistStorage(
      JSON.stringify({
        version: WISHLIST_STORAGE_VERSION,
        ownerId: 42,
        items: [makeItem(ID_A)],
      }),
    );

    expect(result.ownerId).toBeNull();
  });
});

describe("serializeWishlistStorage", () => {
  it("round-trips through parseWishlistStorage", () => {
    const value = {
      version: WISHLIST_STORAGE_VERSION,
      ownerId: USER_ID,
      items: [makeItem(ID_A)],
    };

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
      new Set([ID_A]),
    );

    expect(result).toEqual([
      { ...items[0], status: "sold", snapshot: entry.snapshot },
    ]);
  });

  it("marks requested ids absent from the response as unavailable, keeping their snapshot", () => {
    const items = [makeItem(ID_C, { status: "active" })];

    const result = applyWishlistStatusRefresh(items, new Map(), new Set([ID_C]));

    expect(result).toEqual([{ ...items[0], status: "unavailable" }]);
  });

  it("leaves items untouched when they weren't part of the request (stale response)", () => {
    // A response requested for ID_A resolves after ID_B's list swapped in.
    const items = [makeItem(ID_B, { status: "active" })];

    const result = applyWishlistStatusRefresh(items, new Map(), new Set([ID_A]));

    expect(result).toEqual(items);
    expect(result[0].status).toBe("active");
  });
});

describe("toWishlistMergePayload", () => {
  it("keeps only listingId + snapshot, dropping addedAt/status", () => {
    const item = makeItem(ID_A, { status: "sold" });

    expect(toWishlistMergePayload([item])).toEqual([
      { listingId: ID_A, snapshot: item.snapshot },
    ]);
  });
});

describe("reconcileMergeResult", () => {
  it("adopts the canonical server list unchanged when nothing changed in the window", () => {
    const baseline = [makeItem(ID_A)];
    const server = [makeItem(ID_A), makeItem(ID_B)];

    const result = reconcileMergeResult(baseline, baseline, server);

    expect(result.items.map((i) => i.listingId).sort()).toEqual([ID_A, ID_B]);
    expect(result.resurrectedRemovedIds).toEqual([]);
  });

  it("keeps an item added during the window that the server list is missing", () => {
    const baseline = [makeItem(ID_A)];
    const current = [makeItem(ID_A), makeItem(ID_B)];
    const server = [makeItem(ID_A)];

    const result = reconcileMergeResult(baseline, current, server);

    expect(result.items.map((i) => i.listingId).sort()).toEqual([ID_A, ID_B]);
    expect(result.resurrectedRemovedIds).toEqual([]);
  });

  it("does not duplicate an added item the server list already contains", () => {
    const baseline = [makeItem(ID_A)];
    const current = [makeItem(ID_A), makeItem(ID_B)];
    const server = [makeItem(ID_A), makeItem(ID_B)];

    const result = reconcileMergeResult(baseline, current, server);

    expect(result.items.map((i) => i.listingId).sort()).toEqual([ID_A, ID_B]);
  });

  it("drops an item removed during the window and reports the server resurrection", () => {
    const baseline = [makeItem(ID_A), makeItem(ID_B)];
    const current = [makeItem(ID_A)];
    // The merge upsert re-inserted ID_B (its payload was snapshotted with it).
    const server = [makeItem(ID_A), makeItem(ID_B)];

    const result = reconcileMergeResult(baseline, current, server);

    expect(result.items.map((i) => i.listingId)).toEqual([ID_A]);
    expect(result.resurrectedRemovedIds).toEqual([ID_B]);
  });

  it("drops a removed item without a compensating delete when the server list lacks it", () => {
    const baseline = [makeItem(ID_A), makeItem(ID_B)];
    const current = [makeItem(ID_A)];
    // ID_B failed the existence check, so the merge never re-inserted it.
    const server = [makeItem(ID_A)];

    const result = reconcileMergeResult(baseline, current, server);

    expect(result.items.map((i) => i.listingId)).toEqual([ID_A]);
    expect(result.resurrectedRemovedIds).toEqual([]);
  });

  it("applies a simultaneous add and remove made during the window", () => {
    const baseline = [makeItem(ID_A)];
    const current = [makeItem(ID_C)];
    const server = [makeItem(ID_A), makeItem(ID_B)];

    const result = reconcileMergeResult(baseline, current, server);

    expect(result.items.map((i) => i.listingId).sort()).toEqual([ID_B, ID_C]);
    expect(result.resurrectedRemovedIds).toEqual([ID_A]);
  });

  it("returns items sorted newest-first", () => {
    const baseline: WishlistItem[] = [];
    const older = makeItem(ID_A, { addedAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeItem(ID_B, { addedAt: "2026-06-01T00:00:00.000Z" });

    const result = reconcileMergeResult(baseline, baseline, [older, newer]);

    expect(result.items.map((i) => i.listingId)).toEqual([ID_B, ID_A]);
  });
});

describe("planWishlistReconcile", () => {
  const local = [makeItem(ID_A)];
  const server = [makeItem(ID_B)];

  it("keeps local when signed out", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: false,
        currentUserId: null,
        ownerId: USER_ID,
        localItems: local,
        serverItems: server,
      }),
    ).toEqual({ type: "keep-local" });
  });

  it("keeps local when the server read is unavailable", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: true,
        currentUserId: USER_ID,
        ownerId: null,
        localItems: local,
        serverItems: null,
      }),
    ).toEqual({ type: "keep-local" });
  });

  it("merges a guest (null-owner) cache into the signed-in account", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: true,
        currentUserId: USER_ID,
        ownerId: null,
        localItems: local,
        serverItems: server,
      }),
    ).toEqual({ type: "merge", payload: toWishlistMergePayload(local) });
  });

  it("merges when the cache is already owned by the same signing-in user", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: true,
        currentUserId: USER_ID,
        ownerId: USER_ID,
        localItems: local,
        serverItems: server,
      }),
    ).toEqual({ type: "merge", payload: toWishlistMergePayload(local) });
  });

  it("discards a cache owned by a different user (adopts the server list)", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: true,
        currentUserId: USER_ID,
        ownerId: OTHER_USER_ID,
        localItems: local,
        serverItems: server,
      }),
    ).toEqual({ type: "use-server", items: server });
  });

  it("uses the server list when there is nothing local to merge", () => {
    expect(
      planWishlistReconcile({
        isAuthenticated: true,
        currentUserId: USER_ID,
        ownerId: null,
        localItems: [],
        serverItems: server,
      }),
    ).toEqual({ type: "use-server", items: server });
  });
});
