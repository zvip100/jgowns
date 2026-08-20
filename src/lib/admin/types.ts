import type { Listing, ListingPayment, ListingSize, ListingWithSizes } from "@/lib/types";

/**
 * Admin listing status including `suspended`.
 * Phase 3 must widen marketplace `Listing.status` (and the DB check constraint)
 * to include `suspended`; until then this type stays admin-local so fixtures and
 * UI can render moderation states without touching seller paths.
 */
export type AdminListingStatus =
  | Listing["status"]
  | "suspended";

export type AdminListing = Omit<Listing, "status"> & {
  status: AdminListingStatus;
  sizes: ListingSize[];
  /** Aggregate wishlist saves only — never a named buyer's list (§4.8). */
  saved_count: number;
  seller_email: string;
  /** Present when status is suspended (Phase 3 columns; fixture-only for now). */
  suspension_reason?: string | null;
  suspension_slug?: string | null;
  previous_status?: AdminListingStatus | null;
};

export type AdminUser = {
  id: string;
  email: string;
  provider: "email" | "google";
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_banned: boolean;
  is_admin: boolean;
  listing_counts: {
    active: number;
    sold: number;
    pending_payment: number;
    suspended: number;
    removed: number;
  };
};

export type AdminContactMessage = {
  id: string;
  email: string;
  message: string;
  created_at: string;
};

export type AdminPaymentRow = ListingPayment & {
  seller_email: string;
  listing_title: string;
};

/**
 * `seller` is any non-admin account holder, which is every human on the site
 * who is not the operator: registration is the seller path, and a buyer needs
 * no account to browse or contact a seller.
 */
export type AdminActorRole = "admin" | "seller" | "system";

export const ADMIN_ACTOR_ROLES: AdminActorRole[] = ["admin", "seller", "system"];

export type AdminAuditAction =
  | "listing.suspend"
  | "listing.restore"
  | "listing.mark_sold"
  | "listing.reactivate"
  | "listing.edit"
  | "listing.image_remove"
  | "listing.create"
  | "listing.publish_free"
  | "listing.remove"
  | "listing.delete"
  | "listing.purge"
  | "listing.size_sold"
  | "listing.size_reactivate"
  | "listing.status_change"
  | "payment.checkout_start"
  | "payment.succeeded"
  | "payment.expired"
  | "payment.status_change"
  | "user.ban"
  | "user.unban"
  | "user.sign_out"
  | "user.delete"
  | "user.signup"
  | "user.password_change"
  | "user.email_change"
  | "payment.rescue";

export type AdminAuditLogEntry = {
  id: string;
  /** Null on a system row, and on any row whose account was later deleted. */
  actor_id: string | null;
  /** Null on a system row: a service-role write carries no JWT and no email. */
  actor_email: string | null;
  actor_role: AdminActorRole;
  action: AdminAuditAction;
  entity_type: "listing" | "user" | "payment";
  entity_id: string;
  entity_label: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  /** Tie-breaker for rows sharing a transaction timestamp. */
  sequence: number;
};

export type AdminOverviewStats = {
  active_listings: number;
  sold_listings: number;
  suspended_or_removed: number;
  pending_payment: number;
  total_gowns: number;
  users_total: number;
  new_listings_this_week: number;
  sold_this_week: number;
  new_users_this_week: number;
  fees_collected_this_week_cents: number;
  contact_messages_total: number;
  oldest_contact_message_age_hours: number | null;
};

export type AdminMetricsPoint = {
  week: string;
  listings_created: number;
  listings_sold: number;
  new_users: number;
  fees_collected_cents: number;
};

/** `category` is the stored id, or "uncategorized". Labelling happens in the UI. */
export type AdminCategoryShare = {
  category: string;
  count: number;
};

/** `location` is the stored value, or "unspecified". */
export type AdminLocationShare = {
  location: string;
  count: number;
};

/** Band keys, not labels: the UI owns the wording. Empty bands are included. */
export type AdminPriceBand = {
  band: string;
  count: number;
};

/**
 * Short vocabularies arrive keyed rather than ordered, because both have a
 * deliberate non-alphabetical order the UI already encodes (condition is a
 * quality tier, MEMORY 07-27). A value with no listings is simply absent.
 */
export type AdminMixCounts = Record<string, number>;

export type AdminMetricsSummary = {
  category_share: AdminCategoryShare[];
  location_share: AdminLocationShare[];
  price_bands: AdminPriceBand[];
  condition_mix: AdminMixCounts;
  sell_mode_mix: AdminMixCounts;
  /** Null until at least one listing has sold since sold_at started recording. */
  median_time_to_sold_days: number | null;
  most_wishlisted: { id: string; title: string; saves: number } | null;
  actives_with_no_available_size: number;
  payments: {
    attempts: number;
    succeeded: number;
    pending: number;
    expired: number;
  };
};

export type AdminQueue = {
  /** The queue's true size, which the preview is capped below. */
  count: number;
  rows: AdminListing[];
};

export type AdminOverview = {
  stats: AdminOverviewStats;
  /** The single "now" every queue window and stat tile on the page agrees on. */
  asOf: string;
  newThisWeek: AdminQueue;
  staleActives: AdminQueue;
  offMarket: AdminQueue;
  stuckPending: AdminQueue;
  recentActivity: AdminAuditLogEntry[];
};

export type AdminMetrics = {
  stats: AdminOverviewStats;
  series: AdminMetricsPoint[];
  summary: AdminMetricsSummary;
};

/**
 * Marketplace ListingWithSizes is a subset of admin listing fields. `suspended`
 * maps to `removed` until Phase 3 widens `Listing.status`.
 */
export function toListingWithSizes(listing: AdminListing): ListingWithSizes {
  const {
    saved_count: _saved,
    seller_email: _email,
    suspension_reason: _reason,
    suspension_slug: _slug,
    previous_status: _prev,
    status,
    ...rest
  } = listing;
  const marketplaceStatus: Listing["status"] =
    status === "suspended" ? "removed" : status;
  return { ...rest, status: marketplaceStatus };
}
