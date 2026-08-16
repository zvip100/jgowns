import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  auditFieldLabel,
  describeAuditChanges,
  formatAuditValue,
} from "@/app/(admin)/admin-audit-labels";
import { LogChanges } from "@/app/(admin)/admin/logs/LogChanges";
import { AuditActionPill } from "@/app/(admin)/AuditActionPill";
import {
  ADMIN_STATUS_LABELS,
  ADMIN_STATUS_TONES,
} from "@/app/(admin)/admin-status";
import { StatusPill } from "@/app/(admin)/StatusPill";
import { PILL_TONE_CLASS } from "@/lib/styles";

import type { AdminAuditAction } from "@/app/(admin)/admin-types";

const ALL_ACTIONS: AdminAuditAction[] = [
  "listing.suspend",
  "listing.restore",
  "listing.mark_sold",
  "listing.reactivate",
  "listing.edit",
  "listing.image_remove",
  "user.ban",
  "user.unban",
  "user.sign_out",
  "user.delete",
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
