import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ADMIN_PRICE_BAND_LABELS,
  ADMIN_SELL_MODE_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_SYSTEM_ACTOR_LABEL,
  adminCategoryShareLabel,
  adminLocationShareLabel,
  adminPriceBandLabel,
  auditActorName,
  auditFieldLabel,
  describeAuditChanges,
  formatAuditValue,
} from "@/app/(admin)/admin-audit-labels";
import { ADMIN_ACTOR_ROLES } from "@/lib/admin/types";
import { SELL_MODES } from "@/lib/types";
import { LogChanges } from "@/app/(admin)/admin/logs/LogChanges";
import { AuditActionPill } from "@/app/(admin)/AuditActionPill";
import { AuditActorGlyph } from "@/app/(admin)/AuditActorGlyph";
import {
  ADMIN_STATUS_LABELS,
  ADMIN_STATUS_TONES,
} from "@/app/(admin)/admin-status";
import { StatusPill } from "@/app/(admin)/StatusPill";
import { AUDIT_ROLE_GLYPH_CLASS, PILL_TONE_CLASS } from "@/lib/styles";

import type { AdminAuditAction } from "@/lib/admin/types";

const ALL_ACTIONS: AdminAuditAction[] = [
  "listing.suspend",
  "listing.restore",
  "listing.mark_sold",
  "listing.reactivate",
  "listing.edit",
  "listing.image_remove",
  "listing.create",
  "listing.publish_free",
  "listing.remove",
  "listing.delete",
  "listing.purge",
  "listing.size_sold",
  "listing.size_reactivate",
  "listing.status_change",
  "payment.checkout_start",
  "payment.succeeded",
  "payment.expired",
  "payment.status_change",
  "user.ban",
  "user.unban",
  "user.sign_out",
  "user.delete",
  "user.signup",
  "user.password_change",
  "user.email_change",
  "payment.rescue",
];

describe("AUDIT_ACTION_LABELS", () => {
  it("names every action in the union", () => {
    for (const action of ALL_ACTIONS) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
    }
    expect(Object.keys(AUDIT_ACTION_LABELS)).toHaveLength(ALL_ACTIONS.length);
  });

  it("never leaks the stored value into the label", () => {
    for (const label of Object.values(AUDIT_ACTION_LABELS)) {
      expect(label).not.toContain(".");
      expect(label).not.toContain("_");
      expect(label).not.toContain("—");
    }
  });
});

describe("AUDIT_ACTION_TONES", () => {
  it("gives every action a tone that exists in the shared pill palette", () => {
    for (const action of ALL_ACTIONS) {
      expect(PILL_TONE_CLASS[AUDIT_ACTION_TONES[action]]).toBeTruthy();
    }
  });

  it("reads removals and bans as critical, recoveries as positive", () => {
    expect(AUDIT_ACTION_TONES["listing.suspend"]).toBe("critical");
    expect(AUDIT_ACTION_TONES["user.ban"]).toBe("critical");
    expect(AUDIT_ACTION_TONES["user.delete"]).toBe("critical");
    expect(AUDIT_ACTION_TONES["listing.restore"]).toBe("positive");
    expect(AUDIT_ACTION_TONES["user.unban"]).toBe("positive");
    expect(AUDIT_ACTION_TONES["payment.rescue"]).toBe("positive");
    expect(AUDIT_ACTION_TONES["listing.edit"]).toBe("neutral");
    expect(AUDIT_ACTION_TONES["listing.mark_sold"]).toBe("sold");
  });

  it("keeps the two fallback slugs quiet, since neither should ever appear", () => {
    expect(AUDIT_ACTION_TONES["listing.status_change"]).toBe("neutral");
    expect(AUDIT_ACTION_TONES["payment.status_change"]).toBe("neutral");
  });

  it("separates a seller delete from an unpaid sweep", () => {
    expect(AUDIT_ACTION_LABELS["listing.delete"]).toBe("Listing deleted");
    expect(AUDIT_ACTION_LABELS["listing.purge"]).toBe("Unpaid listing swept");
  });
});

describe("auditActorName", () => {
  it("uses the actor email when there is one", () => {
    expect(auditActorName("leah@example.com", "seller")).toBe(
      "leah@example.com",
    );
    expect(auditActorName("admin@jgowns.com", "admin")).toBe(
      "admin@jgowns.com",
    );
  });

  it("names a service-role row System rather than rendering a blank", () => {
    expect(auditActorName(null, "system")).toBe(AUDIT_SYSTEM_ACTOR_LABEL);
    expect(auditActorName(null, "system")).toBe("System");
  });

  // auth.users.email is nullable, so a real person can have no email. Keying
  // the fallback on the email rather than the role would credit their action to
  // the platform.
  it("does not call an email-less person System", () => {
    expect(auditActorName(null, "seller")).not.toBe("System");
    expect(auditActorName(null, "seller")).toBe("–");
    expect(auditActorName(null, "admin")).toBe("–");
  });
});

describe("AUDIT_ROLE_GLYPH_CLASS", () => {
  it("styles a disc for every actor role", () => {
    for (const role of ADMIN_ACTOR_ROLES) {
      expect(AUDIT_ROLE_GLYPH_CLASS[role]).toBeTruthy();
    }
    expect(Object.keys(AUDIT_ROLE_GLYPH_CLASS)).toHaveLength(
      ADMIN_ACTOR_ROLES.length,
    );
  });

  it("renders a distinct glyph per role", () => {
    const markup = ADMIN_ACTOR_ROLES.map((role) =>
      renderToStaticMarkup(React.createElement(AuditActorGlyph, { role })),
    );
    expect(new Set(markup).size).toBe(ADMIN_ACTOR_ROLES.length);
  });
});

describe("auditFieldLabel", () => {
  it("uses the mapped label for a known field", () => {
    expect(auditFieldLabel("status")).toBe("Status");
    expect(auditFieldLabel("is_banned")).toBe("Account");
    expect(auditFieldLabel("price_cents")).toBe("Price");
  });

  it("humanizes an unmapped field key", () => {
    expect(auditFieldLabel("image_count")).toBe("Image count");
    expect(auditFieldLabel("notes")).toBe("Notes");
  });

  it("names the fields the activity triggers write", () => {
    expect(auditFieldLabel("variant_status")).toBe("Size status");
    expect(auditFieldLabel("payment_status")).toBe("Payment");
    expect(auditFieldLabel("variants")).toBe("Sizes");
    expect(auditFieldLabel("sell_mode")).toBe("Sell mode");
    expect(auditFieldLabel("contact_methods")).toBe("Contact methods");
    expect(auditFieldLabel("bundle_price")).toBe("Set price");
    expect(auditFieldLabel("amount_cents")).toBe("Amount");
    expect(auditFieldLabel("size")).toBe("Size");
  });
});

describe("formatAuditValue", () => {
  it("renders a status through the shared status labels", () => {
    expect(formatAuditValue("status", "pending_payment")).toBe(
      "Payment required",
    );
    expect(formatAuditValue("status", "suspended")).toBe("Suspended");
  });

  it("falls back for a status value the labels do not know", () => {
    expect(formatAuditValue("status", "archived")).toBe("archived");
  });

  it("renders a category id as its marketplace label", () => {
    expect(formatAuditValue("category", "mother-of-the-bride")).toBe(
      "Mother of the Bride",
    );
    expect(formatAuditValue("category", "bridal")).toBe("Bridal");
  });

  it("falls back for a category id that no longer exists", () => {
    expect(formatAuditValue("category", "vintage")).toBe("vintage");
  });

  it("says what a ban flag means", () => {
    expect(formatAuditValue("is_banned", true)).toBe("Banned");
    expect(formatAuditValue("is_banned", false)).toBe("Allowed");
    expect(formatAuditValue("is_banned", null)).toBe("–");
  });

  it("renders a cents field as currency", () => {
    expect(formatAuditValue("price_cents", 45000)).toBe("$450.00");
    expect(formatAuditValue("price_cents", "45000")).toBe("45000");
    expect(formatAuditValue("amount_cents", 500)).toBe("$5.00");
  });

  // bundle_price is numeric(10,2) in dollars, so running it through the cents
  // formatter would show a $500 set as $5.00.
  it("renders bundle_price as dollars, not cents", () => {
    expect(formatAuditValue("bundle_price", 500)).toBe("$500.00");
    expect(formatAuditValue("bundle_price", null)).toBe("–");
  });

  it("labels a variant and a payment status", () => {
    expect(formatAuditValue("variant_status", "available")).toBe("Available");
    expect(formatAuditValue("variant_status", "sold")).toBe("Sold");
    expect(formatAuditValue("payment_status", "succeeded")).toBe("Succeeded");
    expect(formatAuditValue("payment_status", "expired")).toBe("Expired");
    expect(formatAuditValue("payment_status", "refunded")).toBe("refunded");
  });

  it("renders sell mode and contact methods in the site's own wording", () => {
    expect(formatAuditValue("sell_mode", "set_only")).toBe("Set only");
    expect(formatAuditValue("sell_mode", "auction")).toBe("auction");
    expect(formatAuditValue("contact_methods", ["call", "text"])).toBe(
      "call, text",
    );
    expect(formatAuditValue("contact_methods", [])).toBe("–");
  });

  it("reads a variant set as sizes and prices", () => {
    expect(
      formatAuditValue("variants", [
        { size: "12", price: 240 },
        { size: "14", price: "260" },
      ]),
    ).toBe("Size 12 $240.00 · Size 14 $260.00");
    expect(
      formatAuditValue("variants", [
        { size: "12", price: "not a price" },
        { size: "14", price: "" },
        { size: "16" },
      ]),
    ).toBe("Size 12 – · Size 14 – · Size 16 –");
    expect(formatAuditValue("variants", [])).toBe("–");
    expect(formatAuditValue("variants", null)).toBe("–");
  });

  it("renders an absent or empty value as the empty marker", () => {
    expect(formatAuditValue("title", null)).toBe("–");
    expect(formatAuditValue("title", undefined)).toBe("–");
    expect(formatAuditValue("title", "")).toBe("–");
  });

  it("passes text, numbers, and booleans through", () => {
    expect(formatAuditValue("title", "Ivory lace gown")).toBe("Ivory lace gown");
    expect(formatAuditValue("image_count", 3)).toBe("3");
    expect(formatAuditValue("is_admin", true)).toBe("true");
  });

  it("serializes a nested value rather than printing [object Object]", () => {
    expect(formatAuditValue("meta", { a: 1 })).toBe('{"a":1}');
  });
});

describe("describeAuditChanges", () => {
  it("returns nothing when there is no before and no after", () => {
    expect(describeAuditChanges(null, null)).toEqual([]);
  });

  it("describes a status move in plain language", () => {
    expect(
      describeAuditChanges(
        { status: "active" },
        { status: "suspended", previous_status: "active" },
      ),
    ).toEqual([
      { key: "status", label: "Status", from: "Active", to: "Suspended" },
    ]);
  });

  it("hides previous_status even when it is the only field that moved", () => {
    expect(
      describeAuditChanges({ previous_status: null }, { previous_status: "active" }),
    ).toEqual([]);
  });

  it("drops fields that did not actually change", () => {
    const changes = describeAuditChanges(
      { status: "active", title: "Ivory lace gown" },
      { status: "sold", title: "Ivory lace gown" },
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].key).toBe("status");
  });

  it("covers a field present on only one side", () => {
    expect(describeAuditChanges(null, { is_banned: true })).toEqual([
      { key: "is_banned", label: "Account", from: "–", to: "Banned" },
    ]);
    expect(describeAuditChanges({ title: "Old" }, null)).toEqual([
      { key: "title", label: "Title", from: "Old", to: "–" },
    ]);
  });

  it("lists each changed field once, in before-then-after order", () => {
    const changes = describeAuditChanges(
      { title: "Old", status: "active" },
      { status: "sold", price_cents: 45000 },
    );

    expect(changes.map((change) => change.key)).toEqual([
      "title",
      "status",
      "price_cents",
    ]);
  });

  // The digest exists so reordering photos still logs an edit; the count beside
  // it is the part a reader can act on.
  it("hides the image digest while keeping the change it caused visible", () => {
    const changes = describeAuditChanges(
      { image_count: 3, image_digest: "aaa" },
      { image_count: 3, image_digest: "bbb" },
    );

    expect(changes).toEqual([]);

    const withCount = describeAuditChanges(
      { image_count: 2, image_digest: "aaa" },
      { image_count: 3, image_digest: "bbb" },
    );
    expect(withCount.map((change) => change.key)).toEqual(["image_count"]);
  });

  it("describes a variant-only edit through the variants diff", () => {
    const changes = describeAuditChanges(
      { variants: [{ size: "12", price: 260 }] },
      { variants: [{ size: "12", price: 240 }] },
    );

    expect(changes).toEqual([
      {
        key: "variants",
        label: "Sizes",
        from: "Size 12 $260.00",
        to: "Size 12 $240.00",
      },
    ]);
  });
});

describe("AuditActionPill", () => {
  it("renders the readable label, not the stored value", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditActionPill, { action: "listing.suspend" }),
    );

    expect(html).toContain("Listing suspended");
    expect(html).not.toContain("listing.suspend");
  });

  it("carries the tone classes for its action", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditActionPill, { action: "payment.rescue" }),
    );

    expect(html).toContain(PILL_TONE_CLASS.positive);
  });

  it("appends a caller className", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditActionPill, {
        action: "user.ban",
        className: "ml-2",
      }),
    );

    expect(html).toContain("ml-2");
  });
});

describe("StatusPill", () => {
  it("labels every admin status", () => {
    expect(ADMIN_STATUS_LABELS.active).toBe("Active");
    expect(ADMIN_STATUS_LABELS.sold).toBe("Sold");
    expect(ADMIN_STATUS_LABELS.removed).toBe("Removed");
    expect(ADMIN_STATUS_LABELS.pending_payment).toBe("Payment required");
    expect(ADMIN_STATUS_LABELS.suspended).toBe("Suspended");
  });

  it("gives every status a tone", () => {
    expect(Object.keys(ADMIN_STATUS_TONES)).toEqual(
      Object.keys(ADMIN_STATUS_LABELS),
    );
    for (const tone of Object.values(ADMIN_STATUS_TONES)) {
      expect(PILL_TONE_CLASS[tone]).toBeTruthy();
    }
  });

  it("renders through the shared pill tones", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusPill, { status: "suspended" }),
    );

    expect(html).toContain("Suspended");
    expect(html).toContain(PILL_TONE_CLASS.critical);
  });

  it("appends a caller className", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusPill, { status: "active", className: "mt-1" }),
    );

    expect(html).toContain("mt-1");
  });
});

describe("LogChanges", () => {
  const change = (key: string) => ({
    key,
    label: "Status",
    from: "Active",
    to: "Suspended",
  });

  it("shows the empty marker and no toggles when nothing changed", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogChanges, { changes: [], rawJson: "{}" }),
    );

    expect(html).toContain("–");
    expect(html).not.toContain("Raw JSON");
    expect(html).not.toContain("<button");
  });

  it("renders the change inline, with no click required", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogChanges, {
        changes: [change("status")],
        rawJson: "{}",
      }),
    );

    expect(html).toContain("Status");
    expect(html).toContain("Active");
    expect(html).toContain("Suspended");
    expect(html).toContain("→");
  });

  it("offers the raw JSON escape hatch but keeps it closed", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogChanges, {
        changes: [change("status")],
        rawJson: '{"before":{"status":"active"}}',
      }),
    );

    expect(html).toContain("Raw JSON");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<pre");
    expect(html).not.toContain('"before"');
  });

  it("keeps two changes fully inline", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogChanges, {
        changes: [change("status"), change("title")],
        rawJson: "{}",
      }),
    );

    expect(html).not.toContain("more");
  });

  it("lids the overflow past two changes", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogChanges, {
        changes: [
          change("status"),
          change("title"),
          change("price_cents"),
          change("is_banned"),
        ],
        rawJson: "{}",
      }),
    );

    expect(html).toContain("2 more");
  });
});

describe("adminCategoryShareLabel", () => {
  it("labels a stored category id", () => {
    expect(adminCategoryShareLabel("bridal")).toBe("Bridal");
  });

  it("names the null-category placeholder rather than showing a dash", () => {
    expect(adminCategoryShareLabel("uncategorized")).toBe("Uncategorized");
  });
});

describe("adminLocationShareLabel", () => {
  it("passes a stored location through unchanged", () => {
    expect(adminLocationShareLabel("Lakewood")).toBe("Lakewood");
  });

  it("names the null-location placeholder", () => {
    expect(adminLocationShareLabel("unspecified")).toBe("Unspecified");
  });
});

describe("adminPriceBandLabel", () => {
  it("labels every band the RPC can return", () => {
    expect(adminPriceBandLabel("under_100")).toBe("Under $100");
    expect(adminPriceBandLabel("100_249")).toBe("$100–249");
    expect(adminPriceBandLabel("250_499")).toBe("$250–499");
    expect(adminPriceBandLabel("500_999")).toBe("$500–999");
    expect(adminPriceBandLabel("1000_plus")).toBe("$1,000+");
  });

  it("falls back to the raw key if the bands are ever re-cut in SQL", () => {
    expect(adminPriceBandLabel("2000_plus")).toBe("2000_plus");
  });

  it("uses en dashes for the ranges, never em dashes", () => {
    for (const label of Object.values(ADMIN_PRICE_BAND_LABELS)) {
      expect(label).not.toContain("—");
    }
  });
});

describe("ADMIN_SELL_MODE_LABELS", () => {
  it("labels every sell mode", () => {
    for (const mode of SELL_MODES) {
      expect(ADMIN_SELL_MODE_LABELS[mode]).toBeTruthy();
    }
  });
});
