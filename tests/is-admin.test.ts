import { describe, expect, it } from "vitest";

import { isAdmin } from "@/lib/admin/is-admin";

describe("isAdmin", () => {
  it("returns false for null or missing user", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("returns true when app_metadata.role is admin", () => {
    expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
  });

  it("returns false for other roles or missing role", () => {
    expect(isAdmin({ app_metadata: { role: "seller" } })).toBe(false);
    expect(isAdmin({ app_metadata: {} })).toBe(false);
    expect(isAdmin({})).toBe(false);
  });

  it("never trusts user_metadata for the role", () => {
    expect(
      isAdmin({
        app_metadata: {},
        // @ts-expect-error probing that user_metadata is ignored
        user_metadata: { role: "admin" },
      }),
    ).toBe(false);
  });
});
