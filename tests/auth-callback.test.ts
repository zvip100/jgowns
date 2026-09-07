import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureServerEvent, mockCreateClient, mockExchangeCodeForSession } =
  vi.hoisted(() => ({
    mockCaptureServerEvent: vi.fn(),
    mockCreateClient: vi.fn(),
    mockExchangeCodeForSession: vi.fn(),
  }));

vi.mock("@/lib/site", () => ({
  SITE_URL: "https://jgowns.test",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));
vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: mockCaptureServerEvent,
}));

import { GET } from "@/app/api/auth/callback/route";

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`https://localhost:5000/api/auth/callback${query}`);
}

beforeEach(() => {
  mockCaptureServerEvent.mockReset();
  mockExchangeCodeForSession.mockReset();
  mockCreateClient.mockReset().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  });
});

describe("GET auth callback", () => {
  it("redirects successful exchanges to the configured site URL", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u1", app_metadata: { role: "seller" } } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=auth-code&next=%2Fdashboard"),
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/dashboard",
    );
  });

  it("sends an admin to /admin when no explicit next was requested", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u2", app_metadata: { role: "admin" } } },
      error: null,
    });

    const response = await GET(callbackRequest("?code=auth-code"));

    expect(response.headers.get("location")).toBe("https://jgowns.test/admin");
  });

  it("honors an admin's explicitly requested next=/dashboard", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u2", app_metadata: { role: "admin" } } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=auth-code&next=%2Fdashboard"),
    );

    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/dashboard",
    );
  });

  it("drops an admin destination for a non-admin", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u1", app_metadata: { role: "seller" } } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=auth-code&next=%2Fadmin%2Flistings"),
    );

    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/dashboard",
    );
  });

  it("keeps a recovery link's next ahead of the admin home", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u2", app_metadata: { role: "admin" } } },
      error: null,
    });

    const response = await GET(
      callbackRequest("?code=auth-code&next=%2Freset-password"),
    );

    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/reset-password",
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

  it("redirects a banned account's exchange with error=banned", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "User is banned", code: "user_banned" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(callbackRequest("?code=bad-code"));

    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/login?error=banned",
    );
  });
});

describe("auth completion events", () => {
  const CREATED_AT = "2026-09-01T12:00:00.000Z";

  function googleUser(lastSignInAt: string) {
    return {
      id: "u-google",
      app_metadata: { provider: "google", role: "seller" },
      created_at: CREATED_AT,
      last_sign_in_at: lastSignInAt,
    };
  }

  it("counts a confirmed email signup as a registration", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "u-email",
          app_metadata: { provider: "email", role: "seller" },
          created_at: CREATED_AT,
          // Confirmation can land long after signup; email never signs in here.
          last_sign_in_at: "2026-09-03T12:00:00.000Z",
        },
      },
      error: null,
    });

    await GET(callbackRequest("?code=auth-code"));

    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith("register_completed", {
      method: "email",
    });
  });

  it("counts a first Google sign-in as a registration", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: googleUser("2026-09-01T12:00:02.000Z") },
      error: null,
    });

    await GET(callbackRequest("?code=auth-code"));

    expect(mockCaptureServerEvent).toHaveBeenCalledWith("register_completed", {
      method: "google",
    });
  });

  it("counts a returning Google user as a sign-in", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: googleUser("2026-09-04T12:00:00.000Z") },
      error: null,
    });

    await GET(callbackRequest("?code=auth-code"));

    expect(mockCaptureServerEvent).toHaveBeenCalledWith("signin_completed", {
      method: "google",
    });
  });

  it("captures nothing for a password-recovery link", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: googleUser("2026-09-04T12:00:00.000Z") },
      error: null,
    });

    await GET(callbackRequest("?code=auth-code&next=%2Freset-password"));

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it("captures nothing when the exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: "bad code", code: "invalid_grant" },
    });

    await GET(callbackRequest("?code=auth-code"));

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
