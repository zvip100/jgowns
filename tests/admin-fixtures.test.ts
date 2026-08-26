import { describe, expect, it } from "vitest";

import {
  FIXTURE_AUDIT_LOG,
  FIXTURE_LISTINGS,
  FIXTURE_MESSAGES,
  FIXTURE_PAYMENTS,
  FIXTURE_USERS,
  getFixtureListing,
  getFixtureUser,
} from "@/app/(admin)/admin-fixtures";
import { toListingWithSizes } from "@/lib/admin/types";

describe("getFixtureListing", () => {
  it("finds a listing by id", () => {
    const first = FIXTURE_LISTINGS[0];
    expect(getFixtureListing(first.id)?.title).toBe(first.title);
  });

  it("returns undefined for an unknown id", () => {
    expect(getFixtureListing("nope")).toBeUndefined();
  });
});

describe("getFixtureUser", () => {
  it("finds a user by id", () => {
    const first = FIXTURE_USERS[0];
    expect(getFixtureUser(first.id)?.email).toBe(first.email);
  });

  it("returns undefined for an unknown id", () => {
    expect(getFixtureUser("nope")).toBeUndefined();
  });
});

describe("toListingWithSizes", () => {
  it("drops admin-only fields and keeps the marketplace shape", () => {
    const listing = FIXTURE_LISTINGS[0];
    const mapped = toListingWithSizes(listing);
    expect(mapped.id).toBe(listing.id);
    expect(mapped.sizes).toHaveLength(listing.sizes.length);
    expect(mapped).not.toHaveProperty("saved_count");
    expect(mapped).not.toHaveProperty("seller_email");
  });

  it("keeps the moderation columns, which are marketplace fields now", () => {
    const suspended = FIXTURE_LISTINGS.find((l) => l.status === "suspended");
    expect(suspended).toBeDefined();
    const mapped = toListingWithSizes(suspended!);
    expect(mapped.status).toBe("suspended");
    expect(mapped.suspension_slug).toBe(suspended!.suspension_slug);
    expect(mapped.suspension_reason).toBe(suspended!.suspension_reason);
    expect(mapped.previous_status).toBe(suspended!.previous_status);
  });

  it("passes every other status through unchanged", () => {
    for (const listing of FIXTURE_LISTINGS.filter(
      (l) => l.status !== "suspended",
    )) {
      expect(toListingWithSizes(listing).status).toBe(listing.status);
    }
  });
});

describe("fixture integrity", () => {
  it("points every payment and audit row at a real listing or user", () => {
    const listingIds = new Set(FIXTURE_LISTINGS.map((l) => l.id));
    const userIds = new Set(FIXTURE_USERS.map((u) => u.id));

    for (const payment of FIXTURE_PAYMENTS) {
      expect(listingIds.has(payment.listing_id)).toBe(true);
      expect(userIds.has(payment.user_id)).toBe(true);
    }

    for (const entry of FIXTURE_AUDIT_LOG) {
      // A purge row deliberately outlives its listing: entity_id carries no FK
      // precisely so the record of a hard-deleted gown survives.
      if (entry.entity_type !== "user" && entry.action !== "listing.purge") {
        expect(listingIds.has(entry.entity_id)).toBe(true);
      }
      if (entry.entity_type === "user") {
        expect(userIds.has(entry.entity_id)).toBe(true);
      }
    }
  });

  it("attributes every non-system audit row to a real account", () => {
    const userIds = new Set(FIXTURE_USERS.map((u) => u.id));

    for (const entry of FIXTURE_AUDIT_LOG) {
      if (entry.actor_role === "system") {
        expect(entry.actor_id).toBeNull();
        expect(entry.actor_email).toBeNull();
        continue;
      }
      expect(entry.actor_email).toBeTruthy();
      expect(userIds.has(entry.actor_id ?? "")).toBe(true);
    }
  });

  it("gives every audit row a unique sequence, so ties resolve", () => {
    const sequences = FIXTURE_AUDIT_LOG.map((e) => e.sequence);
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("gives every listing a seller that exists", () => {
    const userIds = new Set(FIXTURE_USERS.map((u) => u.id));
    for (const listing of FIXTURE_LISTINGS) {
      expect(userIds.has(listing.user_id)).toBe(true);
    }
  });

  it("ships messages for the inbox", () => {
    expect(FIXTURE_MESSAGES.length).toBeGreaterThan(0);
  });
});
