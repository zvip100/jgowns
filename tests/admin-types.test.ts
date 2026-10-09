import { describe, expect, it } from "vitest";

import { toListingWithSizes } from "@/lib/admin/types";

import type { AdminListing } from "@/lib/admin/types";

function adminListing(overrides: Partial<AdminListing> = {}): AdminListing {
  return {
    id: "listing-1",
    user_id: "seller-1",
    title: "Ivory lace gown",
    description: null,
    color: "Ivory",
    location: "Monsey",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: ["https://x.test/1.avif"],
    image_blur_data_urls: ["data:image/webp;base64,AAAA"],
    contact_email: "seller@example.com",
    contact_phone: null,
    contact_methods: [],
    status: "active",
    created_at: "2026-07-20T14:00:00.000Z",
    suspension_slug: null,
    suspension_reason: null,
    previous_status: null,
    sizes: [
      {
        id: "size-1",
        listing_id: "listing-1",
        size: "8",
        size_group: "adult",
        price: 400,
        status: "available",
        sort_order: 0,
        created_at: "2026-07-20T14:00:00.000Z",
      },
    ],
    saved_count: 12,
    seller_email: "seller@example.com",
    ...overrides,
  };
}

describe("toListingWithSizes", () => {
  it("drops the admin-only fields and keeps the marketplace shape", () => {
    const listing = adminListing();
    const mapped = toListingWithSizes(listing);

    expect(mapped).not.toHaveProperty("saved_count");
    expect(mapped).not.toHaveProperty("seller_email");
    const { saved_count: _saved, seller_email: _email, ...rest } = listing;
    expect(mapped).toEqual(rest);
  });

  it("keeps the moderation columns", () => {
    const mapped = toListingWithSizes(
      adminListing({
        status: "suspended",
        suspension_slug: "prohibited-item",
        suspension_reason: "Not a gown",
        previous_status: "active",
      }),
    );

    expect(mapped.status).toBe("suspended");
    expect(mapped.suspension_slug).toBe("prohibited-item");
    expect(mapped.suspension_reason).toBe("Not a gown");
    expect(mapped.previous_status).toBe("active");
  });
});
