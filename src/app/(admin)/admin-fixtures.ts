import { ADMIN_QUEUE_PREVIEW_SIZE } from "@/lib/admin/constants";
import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
  ADMIN_STUCK_PAYMENT_SEGMENT,
  paginateAdminList,
} from "@/lib/admin/list";

import {
  filterByDateRange,
  matchesListingSegment,
  sortByCreatedDesc,
} from "./admin-list";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type {
  AdminAuditLogEntry,
  AdminCategoryShare,
  AdminContactMessage,
  AdminListing,
  AdminLocationShare,
  AdminMetrics,
  AdminMetricsPoint,
  AdminMixCounts,
  AdminOverview,
  AdminPriceBand,
  AdminOverviewStats,
  AdminPaymentRow,
  AdminQueue,
  AdminUser,
} from "@/lib/admin/types";

/**
 * Phase 1 typed fixtures. Swap imports to `src/lib/queries/admin/*` in Phase 2;
 * markup should not need to change.
 */

/** Fixed "now" so overview queues are deterministic under Cache Components (no Date.now()). */
export const FIXTURE_AS_OF = "2026-07-31T18:00:00.000Z";

/**
 * Inline SVG stand-in for a gown photo. A data URI rather than a remote URL
 * because next.config only allows the Supabase storage host, and rather than a
 * committed binary because these exist purely to give Phase 1 a realistic photo
 * count (every real listing has 1 to 3) so the image-moderation UI is reviewable.
 */
function photo(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#efe4d3"/><text x="60" y="65" font-family="serif" font-size="14" fill="#8a6a44" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const IMG = [photo("Photo 1"), photo("Photo 2"), photo("Photo 3")];

function size(
  id: string,
  listingId: string,
  sizeLabel: string,
  price: number,
  status: "available" | "sold",
  sort: number,
): AdminListing["sizes"][number] {
  return {
    id,
    listing_id: listingId,
    size: sizeLabel,
    size_group: "adult",
    price,
    status,
    sort_order: sort,
    created_at: "2026-06-01T12:00:00.000Z",
  };
}

export const FIXTURE_LISTINGS: AdminListing[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Ivory lace A-line bridal gown",
    description: "Worn once. Soft lace overlay, chapel train.",
    color: "Ivory",
    location: "Borough Park",
    condition: "Perfect Condition",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: IMG.slice(0, 3),
    image_blur_data_urls: [],
    contact_email: "sara@example.com",
    contact_phone: "7185550101",
    contact_methods: ["call", "text"],
    status: "active",
    created_at: "2026-07-20T14:00:00.000Z",
    saved_count: 12,
    seller_email: "sara@example.com",
    sizes: [
      size("s1", "11111111-1111-4111-8111-111111111111", "8", 450, "available", 0),
      size("s2", "11111111-1111-4111-8111-111111111111", "10", 450, "available", 1),
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "Blush mother-of-the-bride set",
    description: "Jacket included. Sell as a complete set only.",
    color: "Blush",
    location: "Lakewood",
    condition: "Brand New",
    category: "mother-of-the-bride",
    sell_mode: "set_only",
    bundle_price: 320,
    image_urls: IMG.slice(0, 2),
    image_blur_data_urls: [],
    contact_email: "leah@example.com",
    contact_phone: null,
    contact_methods: [],
    status: "sold",
    created_at: "2026-06-10T10:00:00.000Z",
    saved_count: 4,
    seller_email: "leah@example.com",
    sizes: [
      size("s3", "22222222-2222-4222-8222-222222222222", "12", 320, "sold", 0),
      size("s4", "22222222-2222-4222-8222-222222222222", "14", 320, "sold", 1),
      size("s11", "22222222-2222-4222-8222-222222222222", "16", 320, "sold", 2),
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Navy girls party dress",
    description: "Size 8. Light wear at hem.",
    color: "Navy",
    location: "Monsey",
    condition: "Needs Alterations",
    category: "girls",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: IMG.slice(0, 1),
    image_blur_data_urls: [],
    contact_email: "sara@example.com",
    contact_phone: "7185550101",
    contact_methods: ["text"],
    status: "pending_payment",
    created_at: "2026-07-28T09:00:00.000Z",
    saved_count: 0,
    seller_email: "sara@example.com",
    sizes: [
      size("s5", "33333333-3333-4333-8333-333333333333", "8", 85, "available", 0),
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Champagne satin evening gown",
    description: "Flagged for image policy review.",
    color: "Champagne",
    location: "Williamsburg",
    condition: "Perfect Condition",
    category: "women",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: IMG.slice(0, 2),
    image_blur_data_urls: [],
    contact_email: "rivka@example.com",
    contact_phone: "3475550199",
    contact_methods: ["call"],
    status: "suspended",
    created_at: "2026-07-01T16:30:00.000Z",
    saved_count: 7,
    seller_email: "rivka@example.com",
    suspension_slug: "image-policy",
    suspension_reason: "Photos show identifiable faces that were not blurred.",
    previous_status: "active",
    sizes: [
      size("s6", "44444444-4444-4444-8444-444444444444", "6", 210, "available", 0),
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "White maternity gown",
    description: "Seller removed after selling privately.",
    color: "White",
    location: "Catskills",
    condition: "Perfect Condition",
    category: "maternity",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: IMG.slice(0, 1),
    image_blur_data_urls: [],
    contact_email: "leah@example.com",
    contact_phone: "8455550144",
    contact_methods: ["call", "text"],
    status: "removed",
    created_at: "2026-05-15T11:00:00.000Z",
    saved_count: 2,
    seller_email: "leah@example.com",
    sizes: [
      size("s7", "55555555-5555-4555-8555-555555555555", "10", 175, "available", 0),
    ],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Gold sequin bridal reception dress",
    description: "Active since early spring. Candidate for stale queue.",
    color: "Gold",
    location: "Monroe",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "either",
    bundle_price: 700,
    image_urls: IMG.slice(0, 3),
    image_blur_data_urls: [],
    contact_email: "chaya@example.com",
    contact_phone: "8455550177",
    contact_methods: ["text"],
    status: "active",
    created_at: "2026-04-01T08:00:00.000Z",
    saved_count: 21,
    seller_email: "chaya@example.com",
    sizes: [
      size("s8", "66666666-6666-4666-8666-666666666666", "4", 400, "available", 0),
      size("s9", "66666666-6666-4666-8666-666666666666", "6", 400, "sold", 1),
      size("s10", "66666666-6666-4666-8666-666666666666", "8", 420, "available", 2),
    ],
  },
];

export const FIXTURE_USERS: AdminUser[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "sara@example.com",
    provider: "email",
    phone: "7185550101",
    created_at: "2026-03-01T12:00:00.000Z",
    last_sign_in_at: "2026-07-30T18:00:00.000Z",
    is_banned: false,
    is_admin: false,
    listing_counts: {
      active: 1,
      sold: 0,
      pending_payment: 1,
      suspended: 0,
      removed: 0,
    },
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "leah@example.com",
    provider: "google",
    phone: "8455550144",
    created_at: "2026-02-10T09:00:00.000Z",
    last_sign_in_at: "2026-07-28T10:00:00.000Z",
    is_banned: false,
    is_admin: false,
    listing_counts: {
      active: 0,
      sold: 1,
      pending_payment: 0,
      suspended: 0,
      removed: 1,
    },
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    email: "rivka@example.com",
    provider: "email",
    phone: "3475550199",
    created_at: "2026-04-20T15:00:00.000Z",
    last_sign_in_at: "2026-07-02T12:00:00.000Z",
    is_banned: true,
    is_admin: false,
    listing_counts: {
      active: 0,
      sold: 0,
      pending_payment: 0,
      suspended: 1,
      removed: 0,
    },
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    email: "chaya@example.com",
    provider: "google",
    phone: null,
    created_at: "2026-01-05T08:00:00.000Z",
    last_sign_in_at: "2026-07-29T20:00:00.000Z",
    is_banned: false,
    is_admin: false,
    listing_counts: {
      active: 1,
      sold: 0,
      pending_payment: 0,
      suspended: 0,
      removed: 0,
    },
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    email: "admin@jgowns.com",
    provider: "email",
    phone: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_sign_in_at: "2026-07-31T09:00:00.000Z",
    is_banned: false,
    is_admin: true,
    listing_counts: {
      active: 0,
      sold: 0,
      pending_payment: 0,
      suspended: 0,
      removed: 0,
    },
  },
];

export const FIXTURE_MESSAGES: AdminContactMessage[] = [
  {
    id: "m1",
    email: "buyer@example.com",
    message:
      "Hi, I am looking for a size 10 bridal gown in Lakewood. Do you have any tips for contacting sellers quickly?",
    created_at: "2026-07-30T14:22:00.000Z",
  },
  {
    id: "m2",
    email: "press@example.com",
    message: "We would love to feature JGowns in an upcoming modest fashion roundup. Who should we speak with?",
    created_at: "2026-07-25T11:05:00.000Z",
  },
  {
    id: "m3",
    email: "sara@example.com",
    message: "I paid the listing fee but my gown still says payment required. Can you help?",
    created_at: "2026-07-29T16:40:00.000Z",
  },
];

export const FIXTURE_PAYMENTS: AdminPaymentRow[] = [
  {
    id: "p1",
    listing_id: "11111111-1111-4111-8111-111111111111",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    stripe_session_id: "cs_test_a1b2c3d4e5",
    amount_cents: 500,
    currency: "usd",
    status: "succeeded",
    created_at: "2026-07-20T14:05:00.000Z",
    paid_at: "2026-07-20T14:06:00.000Z",
    seller_email: "sara@example.com",
    listing_title: "Ivory lace A-line bridal gown",
  },
  {
    id: "p2",
    listing_id: "33333333-3333-4333-8333-333333333333",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    stripe_session_id: "cs_test_pending_99",
    amount_cents: 500,
    currency: "usd",
    status: "pending",
    created_at: "2026-07-28T09:02:00.000Z",
    paid_at: null,
    seller_email: "sara@example.com",
    listing_title: "Navy girls party dress",
  },
  {
    id: "p3",
    listing_id: "66666666-6666-4666-8666-666666666666",
    user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    stripe_session_id: "cs_test_expired_01",
    amount_cents: 500,
    currency: "usd",
    status: "expired",
    created_at: "2026-04-01T08:05:00.000Z",
    paid_at: null,
    seller_email: "chaya@example.com",
    listing_title: "Gold sequin bridal reception dress",
  },
  {
    id: "p4",
    listing_id: "66666666-6666-4666-8666-666666666666",
    user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    stripe_session_id: "cs_test_a9z8y7",
    amount_cents: 500,
    currency: "usd",
    status: "succeeded",
    created_at: "2026-04-01T09:00:00.000Z",
    paid_at: "2026-04-01T09:01:00.000Z",
    seller_email: "chaya@example.com",
    listing_title: "Gold sequin bridal reception dress",
  },
];

/**
 * Ordered oldest-first for readability; every reader sorts. Covers all three
 * actor glyphs, every action pill, and the two rows the UI actually breaks on:
 * a System row with a null actor_email (which is what makes an unguarded
 * `actor_email.toLowerCase()` throw) and a same-transaction pair that differs
 * only by `sequence`.
 */
export const FIXTURE_AUDIT_LOG: AdminAuditLogEntry[] = [
  {
    id: "a4",
    actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    actor_email: "sara@example.com",
    actor_role: "seller",
    action: "user.signup",
    entity_type: "user",
    entity_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entity_label: "sara@example.com",
    reason: null,
    before: null,
    after: { provider: "email" },
    created_at: "2026-03-01T12:00:00.000Z",
    sequence: 1,
  },
  {
    id: "a5",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.create",
    entity_type: "listing",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    before: null,
    after: {
      status: "pending_payment",
      title: "Blush mother-of-the-bride set",
      sell_mode: "set_only",
      bundle_price: 320,
      image_count: 2,
    },
    created_at: "2026-05-02T09:00:00.000Z",
    sequence: 2,
  },
  {
    id: "a6",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "payment.checkout_start",
    entity_type: "payment",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    before: null,
    after: { payment_status: "pending", amount_cents: 500 },
    created_at: "2026-05-02T09:01:00.000Z",
    sequence: 3,
  },
  {
    // Service-role write: no JWT, so no actor at all.
    id: "a7",
    actor_id: null,
    actor_email: null,
    actor_role: "system",
    action: "payment.succeeded",
    entity_type: "payment",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    before: { payment_status: "pending" },
    after: { payment_status: "succeeded", amount_cents: 500 },
    created_at: "2026-05-02T09:03:00.000Z",
    sequence: 4,
  },
  {
    id: "a8",
    actor_id: null,
    actor_email: null,
    actor_role: "system",
    action: "listing.publish_free",
    entity_type: "listing",
    entity_id: "66666666-6666-4666-8666-666666666666",
    entity_label: "Gold sequin bridal reception dress",
    reason: null,
    before: { status: "pending_payment" },
    after: { status: "active" },
    created_at: "2026-05-10T11:00:00.000Z",
    sequence: 5,
  },
  {
    id: "a9",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.edit",
    entity_type: "listing",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    // A variant-only edit: the listing columns are identical and the whole
    // change lives in the variants diff the edit RPC hands to the trigger.
    before: {
      variants: [
        { size: "12", price: 320 },
        { size: "14", price: 320 },
      ],
    },
    after: {
      variants: [
        { size: "12", price: 320 },
        { size: "14", price: 320 },
        { size: "16", price: 320 },
      ],
    },
    created_at: "2026-06-14T16:30:00.000Z",
    sequence: 6,
  },
  {
    // Selling the last available variant emits both rows in one transaction, so
    // they share created_at exactly and only `sequence` orders them.
    id: "a10",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.size_sold",
    entity_type: "listing",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    before: { size: "16", variant_status: "available" },
    after: { size: "16", variant_status: "sold" },
    created_at: "2026-07-05T14:20:00.000Z",
    sequence: 7,
  },
  {
    id: "a11",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.mark_sold",
    entity_type: "listing",
    entity_id: "22222222-2222-4222-8222-222222222222",
    entity_label: "Blush mother-of-the-bride set",
    reason: null,
    before: { status: "active" },
    after: { status: "sold" },
    created_at: "2026-07-05T14:20:00.000Z",
    sequence: 8,
  },
  {
    id: "a1",
    actor_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    actor_email: "admin@jgowns.com",
    actor_role: "admin",
    action: "listing.suspend",
    entity_type: "listing",
    entity_id: "44444444-4444-4444-8444-444444444444",
    entity_label: "Champagne satin evening gown",
    reason: "image-policy: Photos show identifiable faces that were not blurred.",
    before: { status: "active" },
    after: { status: "suspended", previous_status: "active" },
    created_at: "2026-07-15T13:00:00.000Z",
    sequence: 9,
  },
  {
    id: "a2",
    actor_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    actor_email: "admin@jgowns.com",
    actor_role: "admin",
    action: "user.ban",
    entity_type: "user",
    entity_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    entity_label: "rivka@example.com",
    reason: "Repeated image-policy violations",
    before: { is_banned: false },
    after: { is_banned: true },
    created_at: "2026-07-15T13:05:00.000Z",
    sequence: 10,
  },
  {
    id: "a3",
    actor_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    actor_email: "admin@jgowns.com",
    actor_role: "admin",
    action: "listing.edit",
    entity_type: "listing",
    entity_id: "11111111-1111-4111-8111-111111111111",
    entity_label: "Ivory lace A-line bridal gown",
    reason: null,
    // A multi-field edit, so the log shows what the "+N more" lid looks like.
    // `after` matches the listing's current row above.
    before: {
      title: "Ivory lace bridal gown",
      category: "women",
      location: "Williamsburg",
      condition: "Needs Alterations",
      color: null,
    },
    after: {
      title: "Ivory lace A-line bridal gown",
      category: "bridal",
      location: "Borough Park",
      condition: "Perfect Condition",
      color: "Ivory",
    },
    created_at: "2026-07-22T10:00:00.000Z",
    sequence: 11,
  },
  {
    id: "a12",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.reactivate",
    entity_type: "listing",
    entity_id: "55555555-5555-4555-8555-555555555555",
    entity_label: "White maternity gown",
    reason: null,
    before: { status: "sold" },
    after: { status: "active" },
    created_at: "2026-07-24T08:00:00.000Z",
    sequence: 12,
  },
  {
    id: "a13",
    actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    actor_email: "leah@example.com",
    actor_role: "seller",
    action: "listing.remove",
    entity_type: "listing",
    entity_id: "55555555-5555-4555-8555-555555555555",
    entity_label: "White maternity gown",
    reason: null,
    before: { status: "active" },
    after: { status: "removed" },
    created_at: "2026-07-26T09:15:00.000Z",
    sequence: 13,
  },
  {
    // The listing is physically gone; entity_id carries no FK, so the row is
    // all that is left of it.
    id: "a14",
    actor_id: null,
    actor_email: null,
    actor_role: "system",
    action: "listing.purge",
    entity_type: "listing",
    entity_id: "77777777-7777-4777-8777-777777777777",
    entity_label: "Peach flower girl dress",
    reason: null,
    before: { status: "pending_payment", title: "Peach flower girl dress" },
    after: null,
    created_at: "2026-07-28T03:00:00.000Z",
    sequence: 14,
  },
];

export const FIXTURE_OVERVIEW_STATS: AdminOverviewStats = {
  active_listings: 2,
  sold_listings: 1,
  suspended_or_removed: 2,
  pending_payment: 1,
  total_gowns: 11,
  users_total: 5,
  // 1, not 2: the overview's "New this week" card derives its rows from
  // FIXTURE_LISTINGS, and only Navy girls party dress (Jul 28) falls inside
  // 7 days of FIXTURE_AS_OF. In Phase 3 both come from the same query.
  new_listings_this_week: 1,
  sold_this_week: 0,
  new_users_this_week: 0,
  // 0: the only succeeded payments in FIXTURE_PAYMENTS are Jul 20 and Apr 1,
  // both outside 7 days of FIXTURE_AS_OF.
  fees_collected_this_week_cents: 0,
  contact_messages_total: 3,
  // Oldest message is Jul 25 11:05, 150 completed hours before FIXTURE_AS_OF.
  oldest_contact_message_age_hours: 150,
};

export const FIXTURE_METRICS_SERIES: AdminMetricsPoint[] = [
  { week: "May 5", listings_created: 2, listings_sold: 1, new_users: 1, fees_collected_cents: 1000 },
  { week: "May 12", listings_created: 5, listings_sold: 2, new_users: 2, fees_collected_cents: 2000 },
  { week: "May 19", listings_created: 3, listings_sold: 1, new_users: 1, fees_collected_cents: 1500 },
  { week: "May 26", listings_created: 4, listings_sold: 2, new_users: 3, fees_collected_cents: 2000 },
  { week: "Jun 2", listings_created: 4, listings_sold: 1, new_users: 2, fees_collected_cents: 1500 },
  { week: "Jun 9", listings_created: 6, listings_sold: 2, new_users: 1, fees_collected_cents: 2000 },
  { week: "Jun 16", listings_created: 3, listings_sold: 1, new_users: 3, fees_collected_cents: 1000 },
  { week: "Jun 23", listings_created: 5, listings_sold: 3, new_users: 2, fees_collected_cents: 2500 },
  { week: "Jun 30", listings_created: 7, listings_sold: 2, new_users: 1, fees_collected_cents: 3000 },
  { week: "Jul 7", listings_created: 4, listings_sold: 4, new_users: 2, fees_collected_cents: 1500 },
  { week: "Jul 14", listings_created: 8, listings_sold: 3, new_users: 4, fees_collected_cents: 3500 },
  { week: "Jul 21", listings_created: 5, listings_sold: 2, new_users: 1, fees_collected_cents: 2000 },
];

// Stored category ids, not labels: the metrics page runs both data sources
// through the same id-to-label mapping.
export const FIXTURE_CATEGORY_SHARE: AdminCategoryShare[] = [
  { category: "bridal", count: 12 },
  { category: "mother-of-the-bride", count: 7 },
  { category: "girls", count: 5 },
  { category: "women", count: 4 },
  { category: "maternity", count: 2 },
];

// Stored location values, not labels, matching the real query.
export const FIXTURE_LOCATION_SHARE: AdminLocationShare[] = [
  { location: "Lakewood", count: 9 },
  { location: "Borough Park", count: 7 },
  { location: "Monsey", count: 6 },
  { location: "Williamsburg", count: 4 },
  { location: "Monroe", count: 3 },
  { location: "Catskills", count: 1 },
];

// Band keys in their natural order, empty bands included, as the RPC returns them.
export const FIXTURE_PRICE_BANDS: AdminPriceBand[] = [
  { band: "under_100", count: 3 },
  { band: "100_249", count: 8 },
  { band: "250_499", count: 11 },
  { band: "500_999", count: 6 },
  { band: "1000_plus", count: 2 },
];

function countBy<T>(items: T[], key: (item: T) => string): AdminMixCounts {
  const counts: AdminMixCounts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function getFixtureListing(id: string): AdminListing | undefined {
  return FIXTURE_LISTINGS.find((l) => l.id === id);
}

export function getFixtureUser(id: string): AdminUser | undefined {
  return FIXTURE_USERS.find((u) => u.id === id);
}

// ---------------------------------------------------------------------------
// Demo data path
// ---------------------------------------------------------------------------
// In-memory counterparts to every `src/lib/queries/admin/*` reader, selected by
// the demo cookie. They mirror the real queries' filtering, ordering, and
// pagination so the two modes are comparable rather than merely both populated.
// See ADMIN_DEMO_COOKIE in lib/admin/constants for the removal checklist.

export function demoListings(
  params: AdminListParams,
): AdminListResult<AdminListing> {
  let rows = FIXTURE_LISTINGS.filter((l) =>
    matchesListingSegment(params.status, l, FIXTURE_AS_OF),
  );
  if (params.query) {
    rows = rows.filter((l) => l.title.toLowerCase().includes(params.query));
  }
  rows = filterByDateRange(rows, params, (l) => l.created_at);

  return paginateAdminList(sortByCreatedDesc(rows), params);
}

export function demoUsers(params: AdminListParams): AdminListResult<AdminUser> {
  let rows = FIXTURE_USERS;
  if (params.status === "banned") rows = rows.filter((u) => u.is_banned);
  else if (params.status === "admin") rows = rows.filter((u) => u.is_admin);
  else if (params.status === "active") rows = rows.filter((u) => !u.is_banned);

  if (params.query) {
    rows = rows.filter((u) => u.email.toLowerCase().includes(params.query));
  }
  rows = filterByDateRange(rows, params, (u) => u.created_at);

  return paginateAdminList(sortByCreatedDesc(rows), params);
}

export function demoMessages(
  params: AdminListParams,
): AdminListResult<AdminContactMessage> {
  let rows = FIXTURE_MESSAGES;
  if (params.query) {
    rows = rows.filter((m) => m.email.toLowerCase().includes(params.query));
  }
  rows = filterByDateRange(rows, params, (m) => m.created_at);

  return paginateAdminList(sortByCreatedDesc(rows), params);
}

export function demoPayments(
  params: AdminListParams,
): AdminListResult<AdminPaymentRow> {
  let rows = FIXTURE_PAYMENTS;
  if (params.status !== "all") {
    rows = rows.filter((p) => p.status === params.status);
  }
  if (params.query) {
    rows = rows.filter((p) =>
      p.listing_title.toLowerCase().includes(params.query),
    );
  }
  rows = filterByDateRange(rows, params, (p) => p.created_at);

  return paginateAdminList(sortByCreatedDesc(rows), params);
}

/**
 * Mirrors the real read's `created_at desc, sequence desc`. Sorting on the
 * timestamp alone leaves a same-transaction pair in whichever order the array
 * happened to hold.
 */
function sortAuditNewestFirst(rows: AdminAuditLogEntry[]): AdminAuditLogEntry[] {
  return [...rows].sort((a, b) => {
    const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return delta !== 0 ? delta : b.sequence - a.sequence;
  });
}

export function demoAuditLog(
  params: AdminListParams,
  /** Slugs whose human label matched the search, resolved by the page. */
  labelMatchedActions: string[] = [],
): AdminListResult<AdminAuditLogEntry> {
  let rows = FIXTURE_AUDIT_LOG;
  if (params.status !== "all") {
    rows = rows.filter((e) => e.entity_type === params.status);
  }
  if (params.actor !== "all") {
    rows = rows.filter((e) => e.actor_role === params.actor);
  }
  if (params.query) {
    // A system row carries no actor email, so the predicate has to tolerate it.
    rows = rows.filter(
      (e) =>
        (e.actor_email ?? "").toLowerCase().includes(params.query) ||
        e.action.toLowerCase().includes(params.query) ||
        e.entity_label.toLowerCase().includes(params.query) ||
        labelMatchedActions.includes(e.action),
    );
  }
  rows = filterByDateRange(rows, params, (e) => e.created_at);

  return paginateAdminList(sortAuditNewestFirst(rows), params);
}

/** Everything one fixture user did, for the user-detail activity panel. */
export function demoAuditLogForActor(actorId: string): AdminAuditLogEntry[] {
  return sortAuditNewestFirst(
    FIXTURE_AUDIT_LOG.filter((e) => e.actor_id === actorId),
  );
}

/** A fixture listing's own events plus its payment events, for the timeline. */
export function demoAuditLogForListing(
  listingId: string,
): AdminAuditLogEntry[] {
  return sortAuditNewestFirst(
    FIXTURE_AUDIT_LOG.filter(
      (e) => e.entity_type !== "user" && e.entity_id === listingId,
    ),
  );
}

function demoQueue(segment: string): AdminQueue {
  const rows = sortByCreatedDesc(
    FIXTURE_LISTINGS.filter((l) =>
      matchesListingSegment(segment, l, FIXTURE_AS_OF),
    ),
  );
  return {
    count: rows.length,
    rows: rows.slice(0, ADMIN_QUEUE_PREVIEW_SIZE),
  };
}

export function demoOverview(): AdminOverview {
  return {
    stats: FIXTURE_OVERVIEW_STATS,
    asOf: FIXTURE_AS_OF,
    newThisWeek: demoQueue(ADMIN_NEW_WEEK_SEGMENT),
    staleActives: demoQueue(ADMIN_STALE_ACTIVE_SEGMENT),
    offMarket: demoQueue(ADMIN_OFF_MARKET_STATUS),
    stuckPending: demoQueue(ADMIN_STUCK_PAYMENT_SEGMENT),
    recentActivity: sortAuditNewestFirst(FIXTURE_AUDIT_LOG).slice(
      0,
      ADMIN_QUEUE_PREVIEW_SIZE,
    ),
  };
}

export function demoMetrics(): AdminMetrics {
  const mostWishlisted = [...FIXTURE_LISTINGS].sort(
    (a, b) => b.saved_count - a.saved_count,
  )[0];

  const soldWithDates = FIXTURE_LISTINGS.filter((l) => l.status === "sold");

  return {
    stats: FIXTURE_OVERVIEW_STATS,
    series: FIXTURE_METRICS_SERIES,
    summary: {
      category_share: FIXTURE_CATEGORY_SHARE,
      location_share: FIXTURE_LOCATION_SHARE,
      price_bands: FIXTURE_PRICE_BANDS,
      // Derived from the listing fixtures so the mixes agree with the rows the
      // other admin pages show in demo mode.
      condition_mix: countBy(FIXTURE_LISTINGS, (l) => l.condition),
      sell_mode_mix: countBy(FIXTURE_LISTINGS, (l) => l.sell_mode),
      // Fixtures carry no sold_at, so this stands in for a plausible median
      // rather than being derived from the rows above.
      median_time_to_sold_days: soldWithDates.length ? 18.5 : null,
      most_wishlisted: mostWishlisted
        ? {
            id: mostWishlisted.id,
            title: mostWishlisted.title,
            saves: mostWishlisted.saved_count,
          }
        : null,
      actives_with_no_available_size: FIXTURE_LISTINGS.filter(
        (l) =>
          l.status === "active" && l.sizes.every((s) => s.status === "sold"),
      ).length,
      payments: {
        attempts: FIXTURE_PAYMENTS.length,
        succeeded: FIXTURE_PAYMENTS.filter((p) => p.status === "succeeded")
          .length,
        pending: FIXTURE_PAYMENTS.filter((p) => p.status === "pending").length,
        expired: FIXTURE_PAYMENTS.filter((p) => p.status === "expired").length,
      },
    },
  };
}
