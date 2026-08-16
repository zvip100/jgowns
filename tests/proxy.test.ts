import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateServerClient, mockGetUser } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

import { config, proxy } from "@/proxy";

const ADMIN = { id: "u1", app_metadata: { role: "admin" } };
const SELLER = { id: "u2", app_metadata: { role: "seller" } };

function request(path: string): NextRequest {
  return new NextRequest(`https://jgowns.test${path}`);
}

/** Mirrors what Supabase does when it rotates a token mid-verification. */
function setSession(
  user: unknown,
  cookiesToSet: { name: string; value: string }[] = [],
) {
  mockGetUser.mockResolvedValue({ data: { user } });
  mockCreateServerClient.mockImplementation((_url, _key, options) => {
    options.cookies.setAll(cookiesToSet);
    return { auth: { getUser: mockGetUser } };
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCreateServerClient.mockReset();
});

describe("proxy matcher", () => {
  it("covers the dashboard and admin URLs, not the route group folder", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/admin/:path*"]);
  });
});

describe("proxy dashboard gate", () => {
  it("redirects signed-out visitors to login, preserving the destination", async () => {
    setSession(null);

    const response = await proxy(request("/dashboard/new?step=2"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://jgowns.test/login?next=%2Fdashboard%2Fnew%3Fstep%3D2",
    );
  });

  it("lets any signed-in user through", async () => {
    setSession(SELLER);

    const response = await proxy(request("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("carries rotated session cookies onto the login redirect", async () => {
    setSession(null, [{ name: "sb-access-token", value: "" }]);

    const response = await proxy(request("/dashboard"));

    expect(response.cookies.get("sb-access-token")?.value).toBe("");
  });
});

describe("proxy admin gate", () => {
  it("rewrites signed-out visitors to the 404 route instead of login", async () => {
    setSession(null);

    const response = await proxy(request("/admin"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/_not-found",
    );
  });

  it("rewrites authenticated non-admins to the same 404 route", async () => {
    setSession(SELLER);

    const response = await proxy(request("/admin/listings?status=active"));

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/_not-found",
    );
  });

  it("never leaks the destination the way a login redirect would", async () => {
    setSession(SELLER);

    const response = await proxy(request("/admin"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("lets admins through untouched", async () => {
    setSession(ADMIN);

    const response = await proxy(request("/admin/users/abc"));

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("reads the role from app_metadata only, never user_metadata", async () => {
    setSession({ id: "u3", user_metadata: { role: "admin" }, app_metadata: {} });

    const response = await proxy(request("/admin"));

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/_not-found",
    );
  });

  it("carries rotated session cookies onto the rewrite", async () => {
    setSession(SELLER, [{ name: "sb-access-token", value: "rotated" }]);

    const response = await proxy(request("/admin"));

    expect(response.cookies.get("sb-access-token")?.value).toBe("rotated");
  });
});
