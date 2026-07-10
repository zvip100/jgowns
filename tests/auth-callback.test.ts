import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockExchangeCodeForSession } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/site-url", () => ({
  SITE_URL: "https://jgowns.test",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "@/app/api/auth/callback/route";

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`https://localhost:5000/api/auth/callback${query}`);
}

beforeEach(() => {
  mockExchangeCodeForSession.mockReset();
  mockCreateClient.mockReset().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  });
});

describe("GET auth callback", () => {
  it("redirects successful exchanges to the configured site URL", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      callbackRequest("?code=auth-code&next=%2Fdashboard"),
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/dashboard",
    );
  });

  it("redirects missing codes to the configured site's login page", async () => {
    const response = await GET(
      callbackRequest("?next=%2Fdashboard%2Fnew"),
    );

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/login?error=auth&next=%2Fdashboard%2Fnew",
    );
  });

  it("redirects failed exchanges to the configured site's login page", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "Invalid code" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(callbackRequest("?code=bad-code"));

    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/login?error=auth",
    );
  });
});
