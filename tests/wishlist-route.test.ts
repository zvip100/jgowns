import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetWishlistStatus } = vi.hoisted(() => ({
  mockGetWishlistStatus: vi.fn(),
}));

vi.mock("@/lib/queries/wishlist", () => ({
  getWishlistStatus: mockGetWishlistStatus,
}));

import { GET } from "@/app/api/wishlist/status/route";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";

function statusRequest(query: string): NextRequest {
  return new NextRequest(`https://localhost:5000/api/wishlist/status${query}`);
}

beforeEach(() => {
  mockGetWishlistStatus.mockReset().mockResolvedValue([]);
});

describe("GET /api/wishlist/status", () => {
  it("returns an empty item list without querying when ids is missing", async () => {
    const response = await GET(statusRequest(""));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(mockGetWishlistStatus).not.toHaveBeenCalled();
  });

  it("rejects more than 50 ids without querying", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`).join(",");

    const response = await GET(statusRequest(`?ids=${ids}`));

    expect(response.status).toBe(400);
    expect(mockGetWishlistStatus).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without querying", async () => {
    const response = await GET(statusRequest("?ids=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(mockGetWishlistStatus).not.toHaveBeenCalled();
  });

  it("dedupes and trims ids before querying", async () => {
    await GET(statusRequest(`?ids=${ID_A}, ${ID_A},${ID_B}`));

    expect(mockGetWishlistStatus).toHaveBeenCalledExactlyOnceWith([ID_A, ID_B]);
  });

  it("returns the query result with a private, short-lived Cache-Control header", async () => {
    const items = [
      {
        id: ID_A,
        status: "active" as const,
        snapshot: { title: "Gown", priceLabel: "$400", image: null, blurDataUrl: null },
      },
    ];
    mockGetWishlistStatus.mockResolvedValue(items);

    const response = await GET(statusRequest(`?ids=${ID_A}`));

    expect(await response.json()).toEqual({ items });
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it("returns 502 without the success cache header when the query fails", async () => {
    mockGetWishlistStatus.mockRejectedValue(new Error("boom"));

    const response = await GET(statusRequest(`?ids=${ID_A}`));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Failed to load wishlist status.",
    });
    expect(response.headers.get("Cache-Control")).not.toBe("private, max-age=60");
  });
});
