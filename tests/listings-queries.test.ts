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

const VALID_ID = "11111111-1111-1111-1111-111111111111";
const MOCK_LISTING = { id: VALID_ID, title: "Test Gown", price: 500 };

describe("fetchListingWithFallback", () => {
  beforeEach(() => {
    anonMaybeSingle.mockReset();
    sessionMaybeSingle.mockReset();
  });

  it("returns the listing when the public query finds it", async () => {
    anonMaybeSingle.mockResolvedValue({ data: MOCK_LISTING, error: null });

    const result = await fetchListingWithFallback(VALID_ID);

    expect(result.listing).toEqual(MOCK_LISTING);
    expect(result.error).toBeNull();
    expect(sessionMaybeSingle).not.toHaveBeenCalled();
  });

  it("falls back to session query when the public query returns no listing", async () => {
    anonMaybeSingle.mockResolvedValue({ data: null, error: null });
    sessionMaybeSingle.mockResolvedValue({ data: MOCK_LISTING, error: null });

    const result = await fetchListingWithFallback(VALID_ID);

    expect(result.listing).toEqual(MOCK_LISTING);
    expect(result.error).toBeNull();
    expect(sessionMaybeSingle).toHaveBeenCalledOnce();
  });

  it("returns the error and skips the session query when the public query errors", async () => {
    anonMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection failed", details: "", hint: "", code: "PGRST" },
    });

    const result = await fetchListingWithFallback(VALID_ID);

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
