import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetClaims, mockCreateClient } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { getCurrentUser } from "@/lib/queries/auth";

beforeEach(() => {
  mockGetClaims.mockReset();
  mockCreateClient
    .mockReset()
    .mockResolvedValue({ auth: { getClaims: mockGetClaims } });
});

describe("getCurrentUser", () => {
  it("returns the user id and email from the verified claims", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "u1", email: "a@b.com" } },
      error: null,
    });

    expect(await getCurrentUser()).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("returns null email when the claim has no email", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });

    expect(await getCurrentUser()).toEqual({ id: "u1", email: null });
  });

  it("returns null when there is no session", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null when verification errors", async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: "invalid token" },
    });

    expect(await getCurrentUser()).toBeNull();
  });
});
