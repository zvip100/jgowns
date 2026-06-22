import { describe, it, expect } from "vitest";

import { safePostAuthPath, withPostAuthPath } from "@/lib/auth-redirect";

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

describe("withPostAuthPath", () => {
  it("appends an encoded next when it is non-default", () => {
    expect(withPostAuthPath("/register", "/dashboard/new")).toBe(
      "/register?next=%2Fdashboard%2Fnew",
    );
  });

  it("returns the bare path when next is the default or empty", () => {
    expect(withPostAuthPath("/register", "/dashboard")).toBe("/register");
    expect(withPostAuthPath("/login", "")).toBe("/login");
  });
});
