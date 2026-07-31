import { describe, it, expect, vi, beforeEach } from "vitest";

const { anonMaybeSingle, anonChain, anonClient } = vi.hoisted(() => {
    const anonMaybeSingle = vi.fn();

    const makeChain = (terminal: ReturnType<typeof vi.fn>) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.neq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.range = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = terminal;
      return chain;
    };

    const anonChain = makeChain(anonMaybeSingle);

    return {
      anonMaybeSingle,
      anonChain,
      anonClient: { from: vi.fn().mockReturnValue(anonChain) },
    };
  });

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/anon", () => ({ anonClient }));

import {
  fetchActiveListingsForSitemap,
  fetchListing,
  fetchPriceBounds,
} from "@/lib/queries/listings";

const ID_HIT             = "11111111-1111-1111-1111-111111111111";
const ID_ERROR           = "33333333-3333-3333-3333-333333333333";
const ID_SORTED_SIZES    = "44444444-4444-4444-4444-444444444444";
const ID_EXCLUDED_STATUS = "55555555-5555-5555-5555-555555555555";

describe("fetchListing", () => {
  beforeEach(() => {
    anonMaybeSingle.mockReset();
    (anonChain.eq as ReturnType<typeof vi.fn>).mockClear();
    (anonChain.in as ReturnType<typeof vi.fn>).mockClear();
  });

  it("returns the listing when the query finds it", async () => {
    const listing = { id: ID_HIT, title: "Test Gown", sizes: [] };
    anonMaybeSingle.mockResolvedValue({ data: listing, error: null });

    const result = await fetchListing(ID_HIT);

    expect(result.listing).toEqual(listing);
    expect(result.error).toBeNull();
    expect(anonChain.in).toHaveBeenCalledWith("status", ["active", "sold"]);
  });

  it("orders embedded sizes by sort_order then size", async () => {
    const sizeRow = (id: string, size: string, sort_order: number) => ({
      id,
      size,
      sort_order,
      status: "available",
    });
    anonMaybeSingle.mockResolvedValue({
      data: {
        id: ID_SORTED_SIZES,
        title: "Test Gown",
        sizes: [sizeRow("c", "12", 2), sizeRow("a", "8", 0), sizeRow("b", "10", 1)],
      },
      error: null,
    });

    const result = await fetchListing(ID_SORTED_SIZES);

    expect(result.listing?.sizes.map((s) => s.size)).toEqual(["8", "10", "12"]);
  });

  it("returns no listing for a row the status filter excludes (removed or pending_payment)", async () => {
    anonMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchListing(ID_EXCLUDED_STATUS);

    expect(result).toEqual({ listing: null, error: null });
    expect(anonChain.in).toHaveBeenCalledWith("status", ["active", "sold"]);
  });

  it("returns the error when the query fails", async () => {
    anonMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection failed", details: "", hint: "", code: "PGRST" },
    });

    const result = await fetchListing(ID_ERROR);

    expect(result.listing).toBeNull();
    expect(result.error).toEqual({ message: "connection failed" });
  });

  it("returns { listing: null, error: null } for a blank id without querying", async () => {
    const result = await fetchListing("   ");

    expect(result).toEqual({ listing: null, error: null });
    expect(anonMaybeSingle).not.toHaveBeenCalled();
  });
});

describe("fetchActiveListingsForSitemap", () => {
  const anonRange = anonChain.range as ReturnType<typeof vi.fn>;
  const listingRows = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => ({
      id: `id-${offset + i}`,
      created_at: "2026-07-01T00:00:00.000Z",
    }));

  beforeEach(() => {
    anonRange.mockReset().mockReturnValue(anonChain);
  });

  it("returns all active listing rows from a single page", async () => {
    const rows = listingRows(3);
    anonRange.mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchActiveListingsForSitemap();

    expect(result).toEqual(rows);
    expect(anonRange).toHaveBeenCalledExactlyOnceWith(0, 999);
  });

  it("paginates until a short page and concatenates all rows", async () => {
    anonRange
      .mockResolvedValueOnce({ data: listingRows(1000), error: null })
      .mockResolvedValueOnce({ data: listingRows(2, 1000), error: null });

    const result = await fetchActiveListingsForSitemap();

    expect(result).toHaveLength(1002);
    expect(anonRange).toHaveBeenCalledTimes(2);
    expect(anonRange).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("stops when a full page is followed by an empty page", async () => {
    anonRange
      .mockResolvedValueOnce({ data: listingRows(1000), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchActiveListingsForSitemap();

    expect(result).toHaveLength(1000);
    expect(anonRange).toHaveBeenCalledTimes(2);
  });

  it("returns the rows gathered so far when a page errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    anonRange
      .mockResolvedValueOnce({ data: listingRows(1000), error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "boom", details: "", hint: "", code: "PGRST" },
      });

    const result = await fetchActiveListingsForSitemap();

    expect(result).toHaveLength(1000);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("fetchPriceBounds", () => {
  const FALLBACK_BOUNDS = { minBound: 0, maxBound: 10000 };
  const priceRow = (price: number | string) => ({
    data: { price, listing: { status: "active" } },
    error: null,
  });

  beforeEach(() => {
    anonMaybeSingle.mockReset();
    (anonChain.order as ReturnType<typeof vi.fn>).mockClear();
  });

  it("returns floored min and ceiled max from two single-row queries", async () => {
    anonMaybeSingle
      .mockResolvedValueOnce(priceRow(149.4))
      .mockResolvedValueOnce(priceRow(2350.2));

    const result = await fetchPriceBounds();

    expect(result).toEqual({ minBound: 149, maxBound: 2351 });
    expect(anonMaybeSingle).toHaveBeenCalledTimes(2);
    expect(anonChain.order).toHaveBeenNthCalledWith(1, "price", {
      ascending: true,
    });
    expect(anonChain.order).toHaveBeenNthCalledWith(2, "price", {
      ascending: false,
    });
  });

  it("pads maxBound when min and max collapse to the same price", async () => {
    anonMaybeSingle
      .mockResolvedValueOnce(priceRow(500))
      .mockResolvedValueOnce(priceRow(500));

    const result = await fetchPriceBounds();

    expect(result).toEqual({ minBound: 500, maxBound: 1500 });
  });

  it("clamps a negative min to 0", async () => {
    anonMaybeSingle
      .mockResolvedValueOnce(priceRow(-50))
      .mockResolvedValueOnce(priceRow(800));

    const result = await fetchPriceBounds();

    expect(result).toEqual({ minBound: 0, maxBound: 800 });
  });

  it("returns fallback bounds when no size rows exist", async () => {
    anonMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchPriceBounds();

    expect(result).toEqual(FALLBACK_BOUNDS);
  });

  it("returns fallback bounds when a price is not numeric", async () => {
    anonMaybeSingle
      .mockResolvedValueOnce(priceRow("not-a-number"))
      .mockResolvedValueOnce(priceRow(800));

    const result = await fetchPriceBounds();

    expect(result).toEqual(FALLBACK_BOUNDS);
  });

  it("returns fallback bounds when either query errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    anonMaybeSingle
      .mockResolvedValueOnce(priceRow(100))
      .mockResolvedValueOnce({
        data: null,
        error: { message: "boom", details: "", hint: "", code: "PGRST" },
      });

    const result = await fetchPriceBounds();

    expect(result).toEqual(FALLBACK_BOUNDS);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
