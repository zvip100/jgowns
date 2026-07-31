import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteListingImages, mockFrom } = vi.hoisted(() => ({
  mockDeleteListingImages: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/actions/images", () => ({
  deleteListingImages: mockDeleteListingImages,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import { POST } from "@/app/api/cleanup/pending-listings/route";

const CLEANUP_SECRET = "test-cleanup-secret";

function cleanupRequest(secret?: string): NextRequest {
  return new NextRequest("https://jgowns.test/api/cleanup/pending-listings", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

function makeDeleteChain(result: { data?: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    lt: vi.fn(),
    select: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  return chain;
}

function setupSupabase(opts: {
  deleteResult?: { data?: unknown; error: unknown };
} = {}) {
  const deleteChain = makeDeleteChain(opts.deleteResult ?? { data: [], error: null });

  mockFrom.mockReturnValue({
    delete: vi.fn().mockReturnValue(deleteChain),
  });

  return { deleteChain };
}

beforeEach(() => {
  process.env.CLEANUP_SECRET = CLEANUP_SECRET;
  mockDeleteListingImages.mockReset();
  mockDeleteListingImages.mockResolvedValue({ ok: true });
  mockFrom.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("POST /api/cleanup/pending-listings", () => {
  it("rejects a request with no secret", async () => {
    const response = await POST(cleanupRequest());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong secret of a different length", async () => {
    const response = await POST(cleanupRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a same-length wrong secret (reaches the timingSafeEqual branch)", async () => {
    const response = await POST(cleanupRequest("x".repeat(CLEANUP_SECRET.length)));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects every request when CLEANUP_SECRET is unset", async () => {
    delete process.env.CLEANUP_SECRET;
    const response = await POST(cleanupRequest(""));
    expect(response.status).toBe(401);
  });

  it("returns deleted: 0 and skips image cleanup when nothing is stale", async () => {
    setupSupabase({ deleteResult: { data: [], error: null } });

    const response = await POST(cleanupRequest(CLEANUP_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 0 });
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
  });

  it("deletes stale rows then their images, in that order", async () => {
    const callOrder: string[] = [];
    const { deleteChain } = setupSupabase();
    // Only the rows the conditional delete actually removed drive image cleanup
    // and the count, guarding against a listing that turned active mid-sweep.
    deleteChain.select.mockImplementation(async () => {
      callOrder.push("db-delete");
      return {
        data: [
          { id: "listing-1", image_urls: ["url-a", "url-b"] },
          { id: "listing-2", image_urls: ["url-c"] },
        ],
        error: null,
      };
    });
    mockDeleteListingImages.mockImplementation(async () => {
      callOrder.push("image-delete");
      return { ok: true };
    });

    const response = await POST(cleanupRequest(CLEANUP_SECRET));

    expect(deleteChain.eq).toHaveBeenCalledWith("status", "pending_payment");
    expect(deleteChain.lt).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(mockDeleteListingImages).toHaveBeenCalledWith(
      ["url-a", "url-b", "url-c"],
      expect.anything(),
    );
    expect(callOrder).toEqual(["db-delete", "image-delete"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2 });
  });

  it("returns 500 and skips image cleanup when the row delete fails", async () => {
    setupSupabase({
      deleteResult: { error: { message: "delete failed" } },
    });

    const response = await POST(cleanupRequest(CLEANUP_SECRET));

    expect(response.status).toBe(500);
    expect(mockDeleteListingImages).not.toHaveBeenCalled();
  });

  it("still reports success when image cleanup fails (DB rows are already gone)", async () => {
    setupSupabase({
      deleteResult: { data: [{ id: "listing-1", image_urls: ["url-a"] }], error: null },
    });
    mockDeleteListingImages.mockResolvedValue({ error: "storage down" });

    const response = await POST(cleanupRequest(CLEANUP_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 1 });
  });
});
