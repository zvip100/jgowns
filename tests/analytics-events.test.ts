import { describe, expect, it } from "vitest";

import {
  BUYER_EVENTS,
  SELLER_EVENTS,
  SERVER_EVENTS,
  SITE_EVENTS,
  listingContactProperties,
  listingSummaryProperties,
  listingViewProperties,
} from "@/lib/analytics/events";

import type { ListingSize, ListingWithSizes } from "@/lib/types";

const ALL_EVENTS = {
  ...BUYER_EVENTS,
  ...SELLER_EVENTS,
  ...SERVER_EVENTS,
  ...SITE_EVENTS,
};

describe("analytics event catalogue", () => {
  it("matches the buyer names in the spec", () => {
    expect(BUYER_EVENTS).toEqual({
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
    });
  });

  it("matches the seller names in the spec", () => {
    expect(SELLER_EVENTS).toEqual({
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
    });
  });

  it("matches the server and site names in the spec", () => {
    expect(SERVER_EVENTS).toEqual({ paymentConfirmed: "payment_confirmed" });
    expect(SITE_EVENTS).toEqual({
      contactFormSubmitted: "contact_form_submitted",
    });
  });

  it("uses a distinct name for every event", () => {
    const names = Object.values(ALL_EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps every name lower_snake_case and free of a PostHog $ prefix", () => {
    for (const name of Object.values(ALL_EVENTS)) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });

  it("omits the events the spec deliberately cut", () => {
    const names: string[] = Object.values(ALL_EVENTS);
    expect(names).not.toContain("listing_shared");
    expect(names).not.toContain("dead_listing_viewed");
    expect(names).not.toContain("filters_applied");
    // §5.5: abandonment is a funnel, never an event.
    expect(names.filter((n) => n.endsWith("_abandoned"))).toEqual([]);
  });
});

let sizeCounter = 0;

function makeSize(overrides: Partial<ListingSize> = {}): ListingSize {
  sizeCounter++;
  return {
    id: `size-${sizeCounter}`,
    listing_id: "listing-1",
    size: "8",
    size_group: "adult",
    price: 400,
    status: "available",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeListing(
  sizes: ListingSize[],
  overrides: Partial<ListingWithSizes> = {},
): ListingWithSizes {
  return {
    id: "listing-1",
    user_id: "user-1",
    title: "Gown",
    description: null,
    color: null,
    location: "Brooklyn",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: [],
    image_blur_data_urls: [],
    contact_email: "a@b.com",
    contact_phone: null,
    contact_methods: [],
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    suspension_slug: null,
    suspension_reason: null,
    previous_status: null,
    sizes,
    ...overrides,
  };
}

describe("listingContactProperties", () => {
  it("sends exactly the four properties the spec lists", () => {
    const listing = makeListing([makeSize({ price: 450 })]);
    expect(listingContactProperties(listing)).toEqual({
      listing_id: "listing-1",
      category: "bridal",
      price: 450,
      location: "Brooklyn",
    });
  });

  it("passes a missing category and location through as null", () => {
    const listing = makeListing([makeSize()], {
      category: null,
      location: null,
    });
    const properties = listingContactProperties(listing);
    expect(properties.category).toBeNull();
    expect(properties.location).toBeNull();
  });

  it("never sends a price band, only the raw number", () => {
    const properties = listingContactProperties(makeListing([makeSize()]));
    expect(properties).not.toHaveProperty("price_band");
    expect(typeof properties.price).toBe("number");
  });
});

describe("listingViewProperties", () => {
  it("sends exactly the nine properties the spec lists", () => {
    const listing = makeListing([
      makeSize({ size: "10", sort_order: 1 }),
      makeSize({ size: "8", sort_order: 0 }),
    ]);

    expect(listingViewProperties(listing)).toEqual({
      listing_id: "listing-1",
      category: "bridal",
      price: 400,
      location: "Brooklyn",
      sizes: ["8", "10"],
      size_groups: ["adult"],
      size_count: 2,
      condition: "Brand New",
      sell_mode: "individual",
    });
  });

  it("uses arrays for sizes, never a singular size", () => {
    const properties = listingViewProperties(makeListing([makeSize()]));
    expect(Array.isArray(properties.sizes)).toBe(true);
    expect(Array.isArray(properties.size_groups)).toBe(true);
    expect(properties).not.toHaveProperty("size");
  });

  it("de-duplicates size groups across variants", () => {
    const listing = makeListing([
      makeSize({ size: "8", size_group: "adult" }),
      makeSize({ size: "10", size_group: "adult" }),
    ]);
    expect(listingViewProperties(listing).size_groups).toEqual(["adult"]);
  });

  it("counts every variant, sold ones included", () => {
    const listing = makeListing([
      makeSize({ size: "8", status: "sold" }),
      makeSize({ size: "10" }),
    ]);
    expect(listingViewProperties(listing).size_count).toBe(2);
  });

  it("reports a set-only listing's bundle price", () => {
    const listing = makeListing(
      [makeSize({ size: "8", price: 400 }), makeSize({ size: "10", price: 500 })],
      { sell_mode: "set_only", bundle_price: 700 },
    );
    const properties = listingViewProperties(listing);
    expect(properties.price).toBe(700);
    expect(properties.sell_mode).toBe("set_only");
  });
});

describe("listingSummaryProperties", () => {
  it("sends only the three properties the spec lists", () => {
    const listing = makeListing([makeSize({ price: 450 })]);
    expect(listingSummaryProperties(listing)).toEqual({
      listing_id: "listing-1",
      category: "bridal",
      price: 450,
    });
  });

  it("omits location, which those events do not carry", () => {
    expect(listingSummaryProperties(makeListing([makeSize()]))).not.toHaveProperty(
      "location",
    );
  });

  it("agrees with the contact builder on id, category and price", () => {
    const listing = makeListing([makeSize({ price: 425 })]);
    const summary = listingSummaryProperties(listing);
    const contact = listingContactProperties(listing);

    expect(summary.listing_id).toBe(contact.listing_id);
    expect(summary.category).toBe(contact.category);
    expect(summary.price).toBe(contact.price);
  });
});
