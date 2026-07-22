import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  anonClient,
  chainSelect,
  chainIn,
  setQueryResult,
  serverClient,
  userChainOrder,
  setUserQueryResult,
} = vi.hoisted(() => {
  let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
  let userQueryResult: { data: unknown; error: unknown } = {
    data: [],
    error: null,
  };

  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  // supabase-js filter builders are themselves thenable; mirror that so
  // `await anonClient.from(...).select(...).in(...).in(...)` resolves.
  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) =>
    resolve(queryResult);

  // Session-scoped chain for getUserWishlist: from().select().order() → thenable.
  const userChain: Record<string, unknown> = {};
  userChain.select = vi.fn().mockReturnValue(userChain);
  userChain.order = vi.fn().mockReturnValue(userChain);
  userChain.then = (
    resolve: (value: { data: unknown; error: unknown }) => void,
  ) => resolve(userQueryResult);

  return {
    anonClient: { from: vi.fn().mockReturnValue(chain) },
    chainSelect: chain.select,
    chainIn: chain.in,
    setQueryResult: (result: { data: unknown; error: unknown }) => {
      queryResult = result;
    },
    serverClient: { from: vi.fn().mockReturnValue(userChain) },
    userChainOrder: userChain.order,
    setUserQueryResult: (result: { data: unknown; error: unknown }) => {
      userQueryResult = result;
    },
  };
});

vi.mock("@/lib/supabase/anon", () => ({ anonClient }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(serverClient),
}));

import { getUserWishlist, getWishlistStatus } from "@/lib/queries/wishlist";

const ID_ACTIVE = "11111111-1111-1111-1111-111111111111";
const ID_SOLD = "22222222-2222-2222-2222-222222222222";

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_ACTIVE,
    title: "Test Gown",
    status: "active",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: ["https://example.com/a.jpg"],
    image_blur_data_urls: ["data:image/webp;base64,abc"],
    sizes: [
      { id: "s1", size: "8", price: 400, status: "available", sort_order: 0 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  (chainSelect as ReturnType<typeof vi.fn>).mockClear();
  (chainIn as ReturnType<typeof vi.fn>).mockClear();
  (userChainOrder as ReturnType<typeof vi.fn>).mockClear();
  setQueryResult({ data: [], error: null });
  setUserQueryResult({ data: [], error: null });
});

describe("getWishlistStatus", () => {
  it("returns an empty array without querying when given no ids", async () => {
    const result = await getWishlistStatus([]);

    expect(result).toEqual([]);
    expect(anonClient.from).not.toHaveBeenCalled();
  });

  it("maps a returned row to a status entry with a derived snapshot", async () => {
    setQueryResult({ data: [listingRow()], error: null });

    const result = await getWishlistStatus([ID_ACTIVE]);

    expect(result).toEqual([
      {
        id: ID_ACTIVE,
        status: "active",
        snapshot: {
          title: "Test Gown",
          priceLabel: "$400",
          image: "https://example.com/a.jpg",
          blurDataUrl: "data:image/webp;base64,abc",
        },
      },
    ]);
  });

  it("reflects a sold status from the row", async () => {
    setQueryResult({
      data: [listingRow({ id: ID_SOLD, status: "sold" })],
      error: null,
    });

    const result = await getWishlistStatus([ID_SOLD]);

    expect(result[0]?.status).toBe("sold");
  });

  it("filters to the requested ids and active/sold statuses", async () => {
    await getWishlistStatus([ID_ACTIVE, ID_SOLD]);

    expect(chainIn).toHaveBeenCalledWith("id", [ID_ACTIVE, ID_SOLD]);
    expect(chainIn).toHaveBeenCalledWith("status", ["active", "sold"]);
  });

  it("throws and logs when the query errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setQueryResult({
      data: null,
      error: { message: "boom", details: "", hint: "", code: "PGRST" },
    });

    await expect(getWishlistStatus([ID_ACTIVE])).rejects.toThrow(
      "Failed to load wishlist status",
    );
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("returns an empty array when data is null without an error", async () => {
    setQueryResult({ data: null, error: null });

    const result = await getWishlistStatus([ID_ACTIVE]);

    expect(result).toEqual([]);
  });
});

const SNAPSHOT = {
  title: "Saved Gown",
  priceLabel: "$300",
  image: "https://example.com/saved.jpg",
  blurDataUrl: null,
};

function wishlistRow(overrides: Record<string, unknown> = {}) {
  return {
    listing_id: ID_ACTIVE,
    created_at: "2026-07-01T00:00:00.000Z",
    snapshot: SNAPSHOT,
    listing: listingRow(),
    ...overrides,
  };
}

describe("getUserWishlist", () => {
  it("maps a joined active listing to live data, newest-first ordered", async () => {
    setUserQueryResult({ data: [wishlistRow()], error: null });

    const result = await getUserWishlist();

    expect(userChainOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(userChainOrder).toHaveBeenCalledWith("listing_id", {
      ascending: true,
    });
    expect(result).toEqual([
      {
        listingId: ID_ACTIVE,
        addedAt: "2026-07-01T00:00:00.000Z",
        status: "active",
        snapshot: {
          title: "Test Gown",
          priceLabel: "$400",
          image: "https://example.com/a.jpg",
          blurDataUrl: "data:image/webp;base64,abc",
        },
      },
    ]);
  });

  it("marks a sold joined listing as sold", async () => {
    setUserQueryResult({
      data: [wishlistRow({ listing: listingRow({ status: "sold" }) })],
      error: null,
    });

    const result = await getUserWishlist();

    expect(result[0]?.status).toBe("sold");
  });

  it("falls back to the stored snapshot when the listing join is null", async () => {
    setUserQueryResult({
      data: [wishlistRow({ listing: null })],
      error: null,
    });

    const result = await getUserWishlist();

    expect(result).toEqual([
      {
        listingId: ID_ACTIVE,
        addedAt: "2026-07-01T00:00:00.000Z",
        status: "unavailable",
        snapshot: SNAPSHOT,
      },
    ]);
  });

  it("throws and logs when the query errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setUserQueryResult({
      data: null,
      error: { message: "boom", details: "", hint: "", code: "PGRST" },
    });

    await expect(getUserWishlist()).rejects.toThrow("Failed to load user wishlist");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("returns an empty array when data is null without an error", async () => {
    setUserQueryResult({ data: null, error: null });

    const result = await getUserWishlist();

    expect(result).toEqual([]);
  });
});
