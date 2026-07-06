import { describe, it, expect, vi, beforeEach } from "vitest";

const { anonMaybeSingle, sessionMaybeSingle, anonClient, mockCreateClient } =
  vi.hoisted(() => {
    const anonMaybeSingle = vi.fn();
    const sessionMaybeSingle = vi.fn();

    const makeChain = (terminal: ReturnType<typeof vi.fn>) => {
      const chain: Record<string, unknown> = {};
      (chain as Record<string, unknown>).select = vi.fn().mockReturnValue(chain);
      (chain as Record<string, unknown>).eq = vi.fn().mockReturnValue(chain);
      (chain as Record<string, unknown>).maybeSingle = terminal;
      return chain;
    };

    return {
      anonMaybeSingle,
      sessionMaybeSingle,
      anonClient: { from: vi.fn().mockReturnValue(makeChain(anonMaybeSingle)) },
      mockCreateClient: vi
        .fn()
        .mockResolvedValue({ from: vi.fn().mockReturnValue(makeChain(sessionMaybeSingle)) }),
    };
  });

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/anon", () => ({ anonClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { fetchListingWithFallback } from "@/lib/listings-queries";

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
