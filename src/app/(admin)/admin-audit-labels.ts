import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { GOWN_CATEGORY_LABELS } from "@/lib/gown-sizes";

import { ADMIN_STATUS_LABELS } from "./admin-status";
import { formatCents } from "./admin-url";

import type { AdminAuditAction } from "./admin-types";
import type { PillTone } from "@/lib/styles";

export const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  "listing.suspend": "Listing suspended",
  "listing.restore": "Listing restored",
  "listing.mark_sold": "Marked sold",
  "listing.reactivate": "Listing reactivated",
  "listing.edit": "Listing edited",
  "listing.image_remove": "Photo removed",
  "user.ban": "User banned",
  "user.unban": "User unbanned",
  "user.sign_out": "Signed out everywhere",
  "user.delete": "User deleted",
  "payment.rescue": "Payment recovered",
};

/**
 * Severity, not entity: a ban and a suspension read the same red whether they
 * hit a listing or a person, so a heavy moderation day is visible while
 * scrolling. Routine edits stay neutral so they never compete.
 */
export const AUDIT_ACTION_TONES: Record<AdminAuditAction, PillTone> = {
  "listing.suspend": "critical",
  "listing.restore": "positive",
  "listing.mark_sold": "sold",
  "listing.reactivate": "positive",
  "listing.edit": "neutral",
  "listing.image_remove": "warning",
  "user.ban": "critical",
  "user.unban": "positive",
  "user.sign_out": "warning",
  "user.delete": "critical",
  "payment.rescue": "positive",
};

export type AuditChange = {
  key: string;
  label: string;
  from: string;
  to: string;
};

/** Bookkeeping the restore path writes, not something an admin chose to do. */
const HIDDEN_FIELDS = new Set(["previous_status"]);

const STATUS_LABEL_BY_VALUE: Record<string, string> = ADMIN_STATUS_LABELS;

const CATEGORY_LABEL_BY_ID: Record<string, string> = GOWN_CATEGORY_LABELS;

/** Category id → label for admin tables and detail facts. */
export function adminCategoryLabel(id: string | null): string {
  return (id && CATEGORY_LABEL_BY_ID[id]) || ADMIN_EMPTY_VALUE;
}

function formatFallbackValue(value: unknown): string {
  if (value === null || value === undefined) return ADMIN_EMPTY_VALUE;
  if (typeof value === "string") return value === "" ? ADMIN_EMPTY_VALUE : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatStatusValue(value: unknown): string {
  if (typeof value === "string" && STATUS_LABEL_BY_VALUE[value]) {
    return STATUS_LABEL_BY_VALUE[value];
  }
  return formatFallbackValue(value);
}

function formatCategoryValue(value: unknown): string {
  if (typeof value === "string" && CATEGORY_LABEL_BY_ID[value]) {
    return CATEGORY_LABEL_BY_ID[value];
  }
  return formatFallbackValue(value);
}

function formatBannedValue(value: unknown): string {
  if (typeof value !== "boolean") return formatFallbackValue(value);
  return value ? "Banned" : "Allowed";
}

function formatPriceValue(value: unknown): string {
  if (typeof value !== "number") return formatFallbackValue(value);
  return formatCents(value);
}

type AuditFieldFormat = {
  label: string;
  format: (value: unknown) => string;
};

const FIELD_FORMATS: Record<string, AuditFieldFormat> = {
  status: { label: "Status", format: formatStatusValue },
  category: { label: "Category", format: formatCategoryValue },
  is_banned: { label: "Account", format: formatBannedValue },
  is_admin: { label: "Role", format: formatFallbackValue },
  title: { label: "Title", format: formatFallbackValue },
  price_cents: { label: "Price", format: formatPriceValue },
  suspension_reason: { label: "Suspension reason", format: formatFallbackValue },
};

/** `image_count` → `Image count`, for a field the map has not named yet. */
function humanizeFieldKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function auditFieldLabel(key: string): string {
  return FIELD_FORMATS[key]?.label ?? humanizeFieldKey(key);
}

export function formatAuditValue(key: string, value: unknown): string {
  const format = FIELD_FORMATS[key]?.format ?? formatFallbackValue;
  return format(value);
}

/**
 * Turns a raw before/after pair into the field-level changes an admin can read.
 * Fields that did not actually move are dropped, so the row shows what the
 * action did rather than everything the write happened to carry.
 */
export function describeAuditChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditChange[] {
  const keys = [...Object.keys(before ?? {}), ...Object.keys(after ?? {})];
  const seen = new Set<string>();
  const changes: AuditChange[] = [];

  for (const key of keys) {
    if (seen.has(key) || HIDDEN_FIELDS.has(key)) continue;
    seen.add(key);

    const from = formatAuditValue(key, before?.[key]);
    const to = formatAuditValue(key, after?.[key]);
    if (from === to) continue;

    changes.push({ key, label: auditFieldLabel(key), from, to });
  }

  return changes;
}
