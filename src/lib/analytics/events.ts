/**
 * The event-name contract. A typo'd name is permanent, because PostHog cannot
 * rename an event retroactively, so call sites always spend a constant from
 * here and never a string literal.
 *
 * Deliberately free of any SDK import: the browser events and the server events
 * live in the same catalogue, and importing `posthog-js` here would drag it into
 * the server bundle (and `posthog-node` into the client one). The typed capture
 * helpers therefore sit beside their SDK, in `client.ts` and `server.ts`.
 */

import { listingPriceValue, sortListingSizes } from "@/lib/listing-variants";

import type { ListingWithSizes } from "@/lib/types";

/** Buyer behavior on browse and listing pages (spec §5.1). */
export const BUYER_EVENTS = {
  listingViewed: "listing_viewed",
  soldListingViewed: "sold_listing_viewed",
  contactCallClicked: "contact_call_clicked",
  contactTextClicked: "contact_text_clicked",
  contactEmailClicked: "contact_email_clicked",
  contactCopied: "contact_copied",
  wishlistAdded: "wishlist_added",
  wishlistRemoved: "wishlist_removed",
  listingPhotosBrowsed: "listing_photos_browsed",
  lightboxOpened: "lightbox_opened",
} as const;

/** Seller funnel, from the sell CTA to Checkout (spec §5.2). */
export const SELLER_EVENTS = {
  sellCtaClicked: "sell_cta_clicked",
  registerStarted: "register_started",
  registerCompleted: "register_completed",
  signinCompleted: "signin_completed",
  listingDraftStarted: "listing_draft_started",
  photoUploadStarted: "photo_upload_started",
  photoUploadSucceeded: "photo_upload_succeeded",
  photoUploadFailed: "photo_upload_failed",
  listingSubmitted: "listing_submitted",
  checkoutStarted: "checkout_started",
} as const;

/**
 * Sent from the server, never the browser: a seller can close the tab the
 * instant payment completes (spec §5.3).
 */
export const SERVER_EVENTS = {
  paymentConfirmed: "payment_confirmed",
} as const;

/** Site-wide events that belong to no funnel (spec §5.4). */
export const SITE_EVENTS = {
  contactFormSubmitted: "contact_form_submitted",
} as const;

export type AnalyticsEventName =
  | (typeof BUYER_EVENTS)[keyof typeof BUYER_EVENTS]
  | (typeof SELLER_EVENTS)[keyof typeof SELLER_EVENTS]
  | (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS]
  | (typeof SITE_EVENTS)[keyof typeof SITE_EVENTS];

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

/**
 * Every listing-scoped event derives its price and sizes here, so one listing
 * can never describe itself two different ways across two events (spec §5.1).
 * No `price_band`: the raw number is sent and PostHog buckets it at query time,
 * because a band label freezes a threshold that cannot be recut later.
 */
export type ListingContactProperties = {
  listing_id: string;
  category: string | null;
  price: number | null;
  location: string | null;
};

export type ListingViewProperties = ListingContactProperties & {
  sizes: string[];
  size_groups: string[];
  size_count: number;
  condition: string;
  sell_mode: string;
};

/** Shared by the four contact events (spec §5.1). */
export function listingContactProperties(
  listing: ListingWithSizes,
): ListingContactProperties {
  return {
    listing_id: listing.id,
    category: listing.category,
    price: listingPriceValue(listing),
    location: listing.location,
  };
}

export function listingViewProperties(
  listing: ListingWithSizes,
): ListingViewProperties {
  const sizes = sortListingSizes(listing.sizes);

  return {
    ...listingContactProperties(listing),
    sizes: sizes.map((s) => s.size),
    size_groups: [...new Set(sizes.map((s) => s.size_group))],
    size_count: sizes.length,
    condition: listing.condition,
    sell_mode: listing.sell_mode,
  };
}

/**
 * `sold_listing_viewed`, `wishlist_added` and `wishlist_removed` carry only
 * these three (spec §5.1). The wishlist drawer knows a saved row's id but not
 * its category or price, so those arrive null from that surface.
 */
export type ListingSummaryProperties = {
  listing_id: string;
  category: string | null;
  price: number | null;
};

export function listingSummaryProperties(
  listing: ListingWithSizes,
): ListingSummaryProperties {
  return {
    listing_id: listing.id,
    category: listing.category,
    price: listingPriceValue(listing),
  };
}
