import { beforeEach, describe, expect, it, vi } from "vitest";

const { anonClient, chainSelect, chainIn, setQueryResult } = vi.hoisted(() => {
  let queryResult: { data: unknown; error: unknown } = { data: [], error: null };

  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  // supabase-js filter builders are themselves thenable; mirror that so
  // `await anonClient.from(...).select(...).in(...).in(...)` resolves.
  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) =>
    resolve(queryResult);

  return {
    anonClient: { from: vi.fn().mockReturnValue(chain) },
    chainSelect: chain.select,
    chainIn: chain.in,
    setQueryResult: (result: { data: unknown; error: unknown }) => {
      queryResult = result;
    },
  };
});

vi.mock("@/lib/supabase/anon", () => ({ anonClient }));

import { getWishlistStatus } from "@/lib/queries/wishlist";

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
  setQueryResult({ data: [], error: null });
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
