import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { GOWN_CATEGORY_LABELS } from "@/lib/gown-sizes";

import { ADMIN_STATUS_LABELS } from "./admin-status";
import { formatCents, formatDollars } from "./admin-url";

import type { AdminActorRole, AdminAuditAction } from "@/lib/admin/types";
import type { PillTone } from "@/lib/styles";
import type { SellMode } from "@/lib/types";

export const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  "listing.suspend": "Listing suspended",
  "listing.restore": "Listing restored",
  "listing.mark_sold": "Marked sold",
  "listing.reactivate": "Listing reactivated",
  "listing.edit": "Listing edited",
  "listing.image_remove": "Photo removed",
  "listing.create": "Listing created",
  "listing.publish_free": "Published free",
  "listing.remove": "Listing removed",
  "listing.delete": "Listing deleted",
  "listing.purge": "Unpaid listing swept",
  "listing.size_sold": "Size sold",
  "listing.size_reactivate": "Size reactivated",
  "listing.status_change": "Status changed",
  "payment.checkout_start": "Checkout started",
  "payment.succeeded": "Fee paid",
  "payment.expired": "Checkout expired",
  "payment.status_change": "Payment status changed",
  "user.ban": "User banned",
  "user.unban": "User unbanned",
  "user.sign_out": "Signed out everywhere",
  "user.delete": "User deleted",
  "user.signup": "Account created",
  "user.password_change": "Password changed",
  "user.email_change": "Email changed",
  "payment.rescue": "Payment recovered",
};

/**
 * Severity, not entity: a ban and a suspension read the same red whether they
 * hit a listing or a person, so a heavy moderation day is visible while
 * scrolling. Routine edits stay neutral so they never compete.
 *
 * `listing.status_change` and `payment.status_change` are the fallback branches
 * of the two triggers. Neither should appear in practice, and one showing up is
 * a signal.
 */
export const AUDIT_ACTION_TONES: Record<AdminAuditAction, PillTone> = {
  "listing.suspend": "critical",
  "listing.restore": "positive",
  "listing.mark_sold": "sold",
  "listing.reactivate": "positive",
  "listing.edit": "neutral",
  "listing.image_remove": "warning",
  "listing.create": "neutral",
  "listing.publish_free": "positive",
  "listing.remove": "warning",
  "listing.delete": "critical",
  "listing.purge": "critical",
  "listing.size_sold": "sold",
  "listing.size_reactivate": "positive",
  "listing.status_change": "neutral",
  "payment.checkout_start": "neutral",
  "payment.succeeded": "positive",
  "payment.expired": "warning",
  "payment.status_change": "neutral",
  "user.ban": "critical",
  "user.unban": "positive",
  "user.sign_out": "warning",
  "user.delete": "critical",
  "user.signup": "positive",
  "user.password_change": "neutral",
  "user.email_change": "warning",
  "payment.rescue": "positive",
};

/** Stands in for the actor email on a system row, which carries none. */
export const AUDIT_SYSTEM_ACTOR_LABEL = "System";

/**
 * The one actor name every activity surface renders. Keyed on the role, not on
 * whether the email happens to be null: auth.users.email is nullable, so a real
 * person can have no email, and calling that row "System" would attribute their
 * action to the platform.
 */
export function auditActorName(
  email: string | null,
  role: AdminActorRole,
): string {
  if (role === "system") return AUDIT_SYSTEM_ACTOR_LABEL;
  return email ?? ADMIN_EMPTY_VALUE;
}

export type AuditChange = {
  key: string;
  label: string;
  from: string;
  to: string;
};

/**
 * Bookkeeping, not something anyone chose to do. `image_digest` is a change
 * marker rather than a value: it exists so reordering photos still logs an
 * edit, and the neighbouring `image_count` is what a reader can act on.
 */
const HIDDEN_FIELDS = new Set(["previous_status", "image_digest"]);

const STATUS_LABEL_BY_VALUE: Record<string, string> = ADMIN_STATUS_LABELS;

const CATEGORY_LABEL_BY_ID: Record<string, string> = GOWN_CATEGORY_LABELS;

/** Category id → label for admin tables and detail facts. */
export function adminCategoryLabel(id: string | null): string {
  return (id && CATEGORY_LABEL_BY_ID[id]) || ADMIN_EMPTY_VALUE;
}

/**
 * Metrics distributions arrive as stored values, so the wording lives here.
 * `uncategorized` and `unspecified` are the placeholders the RPC substitutes
 * for a null column, not stored values.
 */
export function adminCategoryShareLabel(id: string): string {
  return id === "uncategorized" ? "Uncategorized" : adminCategoryLabel(id);
}

export function adminLocationShareLabel(location: string): string {
  return location === "unspecified" ? "Unspecified" : location;
}

/** Band keys from `admin_metrics_summary`, in the order the RPC returns them. */
export const ADMIN_PRICE_BAND_LABELS: Record<string, string> = {
  under_100: "Under $100",
  "100_249": "$100–249",
  "250_499": "$250–499",
  "500_999": "$500–999",
  "1000_plus": "$1,000+",
};

export function adminPriceBandLabel(band: string): string {
  return ADMIN_PRICE_BAND_LABELS[band] ?? band;
}

export const ADMIN_SELL_MODE_LABELS = {
  individual: "Individual",
  set_only: "Set only",
  either: "Either",
} satisfies Record<SellMode, string>;

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

/** bundle_price is numeric(10,2) in dollars, unlike Stripe's amount_cents. */
function formatDollarValue(value: unknown): string {
  if (typeof value !== "number") return formatFallbackValue(value);
  return formatDollars(value);
}

const VARIANT_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  sold: "Sold",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  expired: "Expired",
};

function labelledValue(labels: Record<string, string>) {
  return (value: unknown): string => {
    if (typeof value === "string" && labels[value]) return labels[value];
    return formatFallbackValue(value);
  };
}

function formatSellModeValue(value: unknown): string {
  if (typeof value === "string" && value in ADMIN_SELL_MODE_LABELS) {
    return ADMIN_SELL_MODE_LABELS[value as SellMode];
  }
  return formatFallbackValue(value);
}

function formatListValue(value: unknown): string {
  if (!Array.isArray(value)) return formatFallbackValue(value);
  return value.length === 0 ? ADMIN_EMPTY_VALUE : value.join(", ");
}

type VariantEntry = { size?: unknown; price?: unknown };

/** jsonb numerics arrive as numbers, but a hand-repaired row can carry a string. */
function variantPriceText(price: unknown): string {
  const amount =
    typeof price === "string" && price.trim() !== "" ? Number(price) : price;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return ADMIN_EMPTY_VALUE;
  }
  return formatDollars(amount);
}

/** The variant set a listing edit carried, as `Size 8 $400 · Size 10 $450`. */
function formatVariantsValue(value: unknown): string {
  if (!Array.isArray(value)) return formatFallbackValue(value);
  if (value.length === 0) return ADMIN_EMPTY_VALUE;

  return value
    .map((entry: unknown): string => {
      const { size, price } = (entry ?? {}) as VariantEntry;
      return `Size ${formatFallbackValue(size)} ${variantPriceText(price)}`;
    })
    .join(" · ");
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
  amount_cents: { label: "Amount", format: formatPriceValue },
  bundle_price: { label: "Set price", format: formatDollarValue },
  suspension_reason: { label: "Suspension reason", format: formatFallbackValue },
  size: { label: "Size", format: formatFallbackValue },
  variant_status: {
    label: "Size status",
    format: labelledValue(VARIANT_STATUS_LABELS),
  },
  payment_status: {
    label: "Payment",
    format: labelledValue(PAYMENT_STATUS_LABELS),
  },
  sell_mode: { label: "Sell mode", format: formatSellModeValue },
  contact_methods: { label: "Contact methods", format: formatListValue },
  variants: { label: "Sizes", format: formatVariantsValue },
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
