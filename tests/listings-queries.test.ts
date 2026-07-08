import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  anonMaybeSingle,
  sessionMaybeSingle,
  anonChain,
  anonClient,
  mockCreateClient,
} = vi.hoisted(() => {
    const anonMaybeSingle = vi.fn();
    const sessionMaybeSingle = vi.fn();

    const makeChain = (terminal: ReturnType<typeof vi.fn>) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = terminal;
      return chain;
    };

    const anonChain = makeChain(anonMaybeSingle);

    return {
      anonMaybeSingle,
      sessionMaybeSingle,
      anonChain,
      anonClient: { from: vi.fn().mockReturnValue(anonChain) },
      mockCreateClient: vi
        .fn()
        .mockResolvedValue({ from: vi.fn().mockReturnValue(makeChain(sessionMaybeSingle)) }),
    };
  });

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/anon", () => ({ anonClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import {
  fetchListingWithFallback,
  fetchPriceBounds,
} from "@/lib/listings-queries";

const ID_PUBLIC_HIT    = "11111111-1111-1111-1111-111111111111";
const ID_SESSION_HIT   = "22222222-2222-2222-2222-222222222222";
const ID_PUBLIC_ERROR  = "33333333-3333-3333-3333-333333333333";
const ID_SORTED_SIZES  = "44444444-4444-4444-4444-444444444444";

describe("fetchListingWithFallback", () => {
  beforeEach(() => {
    anonMaybeSingle.mockReset();
    sessionMaybeSingle.mockReset();
  });

  it("returns the listing when the public query finds it", async () => {
    const listing = { id: ID_PUBLIC_HIT, title: "Test Gown", sizes: [] };
    anonMaybeSingle.mockResolvedValue({ data: listing, error: null });

    const result = await fetchListingWithFallback(ID_PUBLIC_HIT);

    expect(result.listing).toEqual(listing);
    expect(result.error).toBeNull();
    expect(sessionMaybeSingle).not.toHaveBeenCalled();
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

    const result = await fetchListingWithFallback(ID_SORTED_SIZES);

    expect(result.listing?.sizes.map((s) => s.size)).toEqual(["8", "10", "12"]);
  });

  it("falls back to session query when the public query returns no listing", async () => {
    const listing = { id: ID_SESSION_HIT, title: "Test Gown", sizes: [] };
    anonMaybeSingle.mockResolvedValue({ data: null, error: null });
    sessionMaybeSingle.mockResolvedValue({ data: listing, error: null });

    const result = await fetchListingWithFallback(ID_SESSION_HIT);

    expect(result.listing).toEqual(listing);
    expect(result.error).toBeNull();
    expect(sessionMaybeSingle).toHaveBeenCalledOnce();
  });

  it("returns the error and skips the session query when the public query errors", async () => {
    anonMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection failed", details: "", hint: "", code: "PGRST" },
    });

    const result = await fetchListingWithFallback(ID_PUBLIC_ERROR);

    expect(result.listing).toBeNull();
    expect(result.error).toEqual({ message: "connection failed" });
    expect(sessionMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns { listing: null, error: null } for a blank id without querying", async () => {
    const result = await fetchListingWithFallback("   ");

    expect(result).toEqual({ listing: null, error: null });
    expect(anonMaybeSingle).not.toHaveBeenCalled();
    expect(sessionMaybeSingle).not.toHaveBeenCalled();
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
