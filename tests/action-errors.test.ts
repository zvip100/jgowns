import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GENERIC_ACTION_ERROR, rpcError } from "@/lib/action-errors";

describe("GENERIC_ACTION_ERROR", () => {
  it("is the one line sellers see for an error they cannot fix", () => {
    expect(GENERIC_ACTION_ERROR).toBe("Something went wrong. Please try again.");
  });
});

describe("rpcError", () => {
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it("returns the mapped message for a known code, without logging", () => {
    const result = rpcError(
      "sell.updateListing",
      { message: "Listing not found", code: "P0002" },
      { P0002: "Listing not found" },
    );

    expect(result).toEqual({ error: "Listing not found" });
    expect(logged).not.toHaveBeenCalled();
  });

  it("hides an unmapped code behind the generic line and logs the real error", () => {
    const error = { message: "duplicate key value violates unique constraint", code: "23505" };

    const result = rpcError("sell.createListing", error, { P0002: "Listing not found" });

    expect(result).toEqual({ error: GENERIC_ACTION_ERROR });
    expect(logged).toHaveBeenCalledWith("[sell.createListing] database error", error);
  });

  it("uses the generic line when the caller maps no codes at all", () => {
    const error = { message: "permission denied for table listings", code: "42501" };

    expect(rpcError("sell.createListing", error)).toEqual({ error: GENERIC_ACTION_ERROR });
    expect(logged).toHaveBeenCalledOnce();
  });

  it("uses the generic line for a transport failure, which carries no code", () => {
    // A bare network failure arrives with no code (or an empty one), so a map
    // keyed by code can never match it.
    expect(
      rpcError("sell.updateListing", { message: "fetch failed" }, { "": "should not match" }),
    ).toEqual({ error: GENERIC_ACTION_ERROR });
    expect(
      rpcError("sell.updateListing", { message: "fetch failed", code: "" }, { "": "should not match" }),
    ).toEqual({ error: GENERIC_ACTION_ERROR });
  });

  it("never returns the raw database text", () => {
    const raw = 'new row violates row-level security policy for table "listings"';

    const { error } = rpcError("sell.createListing", { message: raw, code: "42501" });

    expect(error).not.toContain("row-level security");
    expect(error).not.toBe(raw);
  });
});
