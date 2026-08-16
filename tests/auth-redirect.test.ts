import { describe, it, expect } from "vitest";

import {
  postAuthPath,
  safeNextPath,
  safePostAuthPath,
  withPostAuthPath,
} from "@/lib/auth-redirect";

const ADMIN = { app_metadata: { role: "admin" } };
const SELLER = { app_metadata: { role: "seller" } };

describe("safeNextPath", () => {
  it("returns an internal path unchanged", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/new")).toBe("/dashboard/new");
    expect(safeNextPath("/browse?size=8")).toBe("/browse?size=8");
  });

  it("returns null when nothing was requested", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  it("returns null for external and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("returns null for auth pages and api routes to avoid loops", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/register?next=/x")).toBeNull();
    expect(safeNextPath("/api/auth/callback")).toBeNull();
    expect(safeNextPath("/api")).toBeNull();
    expect(safeNextPath("/api?next=/x")).toBeNull();
    expect(safeNextPath("/api#top")).toBeNull();
  });

  it("keeps a path that only starts with the api segment's letters", () => {
    expect(safeNextPath("/apidocs")).toBe("/apidocs");
  });
});

describe("safePostAuthPath", () => {
  it("returns an internal path unchanged", () => {
    expect(safePostAuthPath("/dashboard/new")).toBe("/dashboard/new");
    expect(safePostAuthPath("/browse?size=8")).toBe("/browse?size=8");
  });

  it("falls back to /dashboard for empty or missing values", () => {
    expect(safePostAuthPath(null)).toBe("/dashboard");
    expect(safePostAuthPath(undefined)).toBe("/dashboard");
    expect(safePostAuthPath("")).toBe("/dashboard");
  });

  it("rejects external and protocol-relative URLs (open-redirect guard)", () => {
    expect(safePostAuthPath("https://evil.com")).toBe("/dashboard");
    expect(safePostAuthPath("//evil.com")).toBe("/dashboard");
    expect(safePostAuthPath("/\\evil.com")).toBe("/dashboard");
    expect(safePostAuthPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects auth pages and api routes to avoid loops", () => {
    expect(safePostAuthPath("/login")).toBe("/dashboard");
    expect(safePostAuthPath("/register?next=/x")).toBe("/dashboard");
    expect(safePostAuthPath("/api/auth/callback")).toBe("/dashboard");
  });
});

describe("postAuthPath", () => {
  it("sends an admin to /admin when no destination was requested", () => {
    expect(postAuthPath(ADMIN, null)).toBe("/admin");
    expect(postAuthPath(ADMIN, undefined)).toBe("/admin");
    expect(postAuthPath(ADMIN, "")).toBe("/admin");
  });

  it("honors an admin's explicit request for the seller dashboard", () => {
    expect(postAuthPath(ADMIN, "/dashboard")).toBe("/dashboard");
    expect(postAuthPath(ADMIN, "/dashboard?tab=sold")).toBe("/dashboard?tab=sold");
  });

  it("keeps an admin's requested admin page", () => {
    expect(postAuthPath(ADMIN, "/admin/listings")).toBe("/admin/listings");
    expect(postAuthPath(ADMIN, "/admin")).toBe("/admin");
  });

  it("drops an admin destination a non-admin has no claim for", () => {
    expect(postAuthPath(SELLER, "/admin/listings")).toBe("/dashboard");
    expect(postAuthPath(SELLER, "/admin")).toBe("/dashboard");
    expect(postAuthPath(SELLER, "/admin?tab=all")).toBe("/dashboard");
  });

  it("does not mistake a lookalike path for the admin surface", () => {
    expect(postAuthPath(SELLER, "/administration")).toBe("/administration");
  });

  it("sends everyone else to the seller dashboard", () => {
    expect(postAuthPath(SELLER, null)).toBe("/dashboard");
    expect(postAuthPath(null, null)).toBe("/dashboard");
    expect(postAuthPath({ app_metadata: {} }, null)).toBe("/dashboard");
  });

  it("lets an explicit next win for admins and sellers alike", () => {
    expect(postAuthPath(ADMIN, "/dashboard/new")).toBe("/dashboard/new");
    expect(postAuthPath(ADMIN, "/reset-password")).toBe("/reset-password");
    expect(postAuthPath(SELLER, "/browse?size=8")).toBe("/browse?size=8");
  });

  it("keeps the open-redirect guard, then applies the admin default", () => {
    expect(postAuthPath(ADMIN, "https://evil.com")).toBe("/admin");
    expect(postAuthPath(ADMIN, "//evil.com")).toBe("/admin");
    expect(postAuthPath(SELLER, "https://evil.com")).toBe("/dashboard");
  });

  it("never trusts user_metadata for the role", () => {
    expect(
      postAuthPath(
        { app_metadata: {}, user_metadata: { role: "admin" } } as {
          app_metadata: Record<string, unknown>;
        },
        null,
      ),
    ).toBe("/dashboard");
  });
});

describe("withPostAuthPath", () => {
  it("appends an encoded next when one was requested", () => {
    expect(withPostAuthPath("/register", "/dashboard/new")).toBe(
      "/register?next=%2Fdashboard%2Fnew",
    );
    expect(withPostAuthPath("/register", "/dashboard")).toBe(
      "/register?next=%2Fdashboard",
    );
  });

  it("returns the bare path when next is empty or unsafe", () => {
    expect(withPostAuthPath("/login", "")).toBe("/login");
    expect(withPostAuthPath("/login", "https://evil.com")).toBe("/login");
  });
});
