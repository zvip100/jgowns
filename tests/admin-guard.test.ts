import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockGetUser, mockIsAdminDemoMode } = vi.hoisted(
  () => ({
    mockCreateClient: vi.fn(),
    mockGetUser: vi.fn(),
    mockIsAdminDemoMode: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/admin/demo", () => ({ isAdminDemoMode: mockIsAdminDemoMode }));

import {
  ADMIN_DEMO_MODE_ERROR,
  ADMIN_NOT_AUTHORIZED_ERROR,
  ADMIN_UNEXPECTED_ERROR,
  getAdminActionClient,
  requireAdmin,
  runAdminAction,
} from "@/lib/admin/guard";

import type { AdminActionClient } from "@/lib/admin/guard";

const ADMIN = {
  id: "admin-1",
  email: "admin@jgowns.com",
  app_metadata: { role: "admin" },
};
const SELLER = {
  id: "seller-1",
  email: "seller@example.com",
  app_metadata: { role: "seller" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
  mockIsAdminDemoMode.mockResolvedValue(false);
});

describe("requireAdmin", () => {
  it("returns the operator's identity for an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    await expect(requireAdmin()).resolves.toEqual({
      id: "admin-1",
      email: "admin@jgowns.com",
    });
  });

  it("throws for a signed-out visitor and for a signed-in non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAdmin()).rejects.toThrow("Not authorized");

    mockGetUser.mockResolvedValue({ data: { user: SELLER } });
    await expect(requireAdmin()).rejects.toThrow("Not authorized");
  });
});

describe("getAdminActionClient", () => {
  it("hands back the operator's own authenticated client", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });

    const result = await getAdminActionClient();
    expect(result.ok).toBe(true);
    expect(result.ok && result.admin).toEqual({
      id: "admin-1",
      email: "admin@jgowns.com",
    });
    expect(result.ok && result.supabase).toBeDefined();
  });

  it("refuses a signed-out visitor without throwing at the client", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(getAdminActionClient()).resolves.toEqual({
      ok: false,
      error: ADMIN_NOT_AUTHORIZED_ERROR,
    });
  });

  it("refuses a signed-in non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SELLER } });
    await expect(getAdminActionClient()).resolves.toEqual({
      ok: false,
      error: ADMIN_NOT_AUTHORIZED_ERROR,
    });
  });

  it("never reads the role from user_metadata", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { ...SELLER, user_metadata: { role: "admin" } },
      },
    });
    await expect(getAdminActionClient()).resolves.toEqual({
      ok: false,
      error: ADMIN_NOT_AUTHORIZED_ERROR,
    });
  });

  it("refuses a real admin while the demo cookie is set", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    mockIsAdminDemoMode.mockResolvedValue(true);

    await expect(getAdminActionClient()).resolves.toEqual({
      ok: false,
      error: ADMIN_DEMO_MODE_ERROR,
    });
  });

  it("checks the claim before the cookie, so demo mode never reads as a reason to allow", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SELLER } });
    mockIsAdminDemoMode.mockResolvedValue(true);

    const result = await getAdminActionClient();
    expect(result).toEqual({ ok: false, error: ADMIN_NOT_AUTHORIZED_ERROR });
    expect(mockIsAdminDemoMode).not.toHaveBeenCalled();
  });
});

describe("runAdminAction", () => {
  it("hands the operator's client to the body and returns its result", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    let seen: AdminActionClient | null = null;

    await expect(
      runAdminAction("scope", async (auth) => {
        seen = auth;
        return {};
      }),
    ).resolves.toEqual({});
    expect(seen).not.toBeNull();
    expect(seen!.admin).toEqual({
      id: "admin-1",
      email: "admin@jgowns.com",
    });
    expect(seen!.supabase).toBeDefined();
  });

  it("returns the body's own typed error unchanged", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    await expect(
      runAdminAction("scope", async () => ({ error: "Listing not found" })),
    ).resolves.toEqual({ error: "Listing not found" });
  });

  it("never runs the body when the guard refuses", async () => {
    const body = vi.fn(async () => ({}));

    mockGetUser.mockResolvedValue({ data: { user: SELLER } });
    await expect(runAdminAction("scope", body)).resolves.toEqual({
      error: ADMIN_NOT_AUTHORIZED_ERROR,
    });

    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    mockIsAdminDemoMode.mockResolvedValue(true);
    await expect(runAdminAction("scope", body)).resolves.toEqual({
      error: ADMIN_DEMO_MODE_ERROR,
    });

    expect(body).not.toHaveBeenCalled();
  });

  it("turns an unexpected throw into a sanitized result rather than rejecting", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });

    await expect(
      runAdminAction("adminBanUser", async () => {
        throw new TypeError("Cannot read properties of null");
      }),
    ).resolves.toEqual({ error: ADMIN_UNEXPECTED_ERROR });

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not leak the thrown message to the caller", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });

    const result = await runAdminAction("scope", async () => {
      throw new Error('relation "listings" does not exist');
    });

    expect(JSON.stringify(result)).not.toContain("relation");
    error.mockRestore();
  });
});

/**
 * The preamble runs INSIDE the error boundary. A server action is an
 * independently callable endpoint, so a throw from any of these three would
 * otherwise reject the promise at the client rather than returning the typed
 * result every caller destructures (AGENTS §7). The refusals below still have
 * to read as refusals, not as internal failures.
 */
describe("runAdminAction: the guard itself is inside the boundary", () => {
  it("sanitizes a throw from createClient", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = vi.fn(async () => ({}));
    mockCreateClient.mockRejectedValue(new Error("cookies() outside a request"));

    await expect(runAdminAction("scope", body)).resolves.toEqual({
      error: ADMIN_UNEXPECTED_ERROR,
    });
    expect(body).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("sanitizes a throw from getUser", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockRejectedValue(new Error("AuthRetryableFetchError"));

    await expect(
      runAdminAction("scope", async () => ({})),
    ).resolves.toEqual({ error: ADMIN_UNEXPECTED_ERROR });
    error.mockRestore();
  });

  it("sanitizes a throw from the demo-cookie read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    mockIsAdminDemoMode.mockRejectedValue(new Error("cookies() unavailable"));

    await expect(
      runAdminAction("scope", async () => ({})),
    ).resolves.toEqual({ error: ADMIN_UNEXPECTED_ERROR });
    error.mockRestore();
  });

  it("still returns the plain refusals, which are returns and not throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SELLER } });
    await expect(runAdminAction("scope", async () => ({}))).resolves.toEqual({
      error: ADMIN_NOT_AUTHORIZED_ERROR,
    });

    mockGetUser.mockResolvedValue({ data: { user: ADMIN } });
    mockIsAdminDemoMode.mockResolvedValue(true);
    await expect(runAdminAction("scope", async () => ({}))).resolves.toEqual({
      error: ADMIN_DEMO_MODE_ERROR,
    });
  });
});
