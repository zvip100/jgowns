import { describe, expect, it } from "vitest";

import { ADMIN_STATUS_LABELS } from "@/app/(admin)/admin-audit-labels";
import { LISTING_STATUSES } from "@/lib/types";
import { LISTING_STATUS_TONE, PILL_TONE_CLASS } from "@/lib/styles";

/**
 * Totality checks over the widened status union. The compiler enforces these
 * for the maps' declared `Record` types, but the seller-side label map in
 * `ListingRow` is module-private, so this is the guard that a sixth status
 * cannot ship with a blank badge on the dashboard.
 */

describe("listing status union", () => {
  it("carries suspended alongside the four original values", () => {
    expect([...LISTING_STATUSES].sort()).toEqual([
      "active",
      "pending_payment",
      "removed",
      "sold",
      "suspended",
    ]);
  });
});

describe("admin status maps", () => {
  it("labels every status, with no blank falling through", () => {
    expect(Object.keys(ADMIN_STATUS_LABELS).sort()).toEqual(
      [...LISTING_STATUSES].sort(),
    );
    for (const status of LISTING_STATUSES) {
      expect(ADMIN_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("gives every status a tone the pill stylesheet actually defines", () => {
    expect(Object.keys(LISTING_STATUS_TONE).sort()).toEqual(
      [...LISTING_STATUSES].sort(),
    );
    for (const status of LISTING_STATUSES) {
      expect(PILL_TONE_CLASS[LISTING_STATUS_TONE[status]]).toBeDefined();
    }
  });

  it("gives suspended its own label and tone rather than inheriting removed's", () => {
    expect(ADMIN_STATUS_LABELS.suspended).toBe("Suspended");
    expect(LISTING_STATUS_TONE.suspended).toBe("critical");
    expect(LISTING_STATUS_TONE.suspended).not.toBe(LISTING_STATUS_TONE.removed);
  });
});
