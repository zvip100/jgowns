import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { ListingStatus, ListingWithSizes } from "@/lib/types";

type LinkProps = { href: string; children?: ReactNode };

vi.mock("next/link", () => ({
  default: ({ href, children }: LinkProps) =>
    React.createElement("a", { href }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

/** The row's action leaves each own a server action; only their presence matters. */
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => () => name,
}));
vi.mock("@/components/CompletePaymentButton", () => ({
  default: stub("complete-payment"),
}));
vi.mock("@/components/MarkSizeSoldButton", () => ({
  default: stub("mark-size-sold"),
}));
vi.mock("@/components/MarkSoldButton", () => ({ default: stub("mark-sold") }));
vi.mock("@/components/ReactivateListingButton", () => ({
  default: stub("reactivate-listing"),
}));
vi.mock("@/components/ReactivateSizeButton", () => ({
  default: stub("reactivate-size"),
}));
vi.mock("@/components/RemoveListingButton", () => ({
  default: stub("remove-listing"),
}));

import ListingRow from "@/components/ListingRow";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const BROWSE_HREF = `/browse/${LISTING_ID}?from=dash`;
const EDIT_HREF = `/dashboard/edit/${LISTING_ID}`;

function makeListing(
  overrides: Partial<ListingWithSizes> = {},
): ListingWithSizes {
  return {
    id: LISTING_ID,
    user_id: "seller-1",
    title: "Ivory lace gown",
    description: null,
    color: null,
    location: "Monsey",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: null,
    image_urls: ["https://proj.supabase.co/a.webp"],
    image_blur_data_urls: [""],
    contact_email: "seller@example.com",
    contact_phone: null,
    contact_methods: [],
    status: "active",
    created_at: "2026-08-01T00:00:00.000Z",
    suspension_slug: null,
    suspension_reason: null,
    previous_status: null,
    sizes: [
      {
        id: "size-1",
        listing_id: LISTING_ID,
        size: "8",
        size_group: "adult",
        price: 400,
        status: "available",
        sort_order: 0,
      },
    ],
    ...overrides,
  } as unknown as ListingWithSizes;
}

function render(status: ListingStatus, extra: Partial<ListingWithSizes> = {}) {
  return renderToStaticMarkup(
    React.createElement(ListingRow, {
      listing: makeListing({ status, ...extra }),
      listingFeeActive: true,
    }),
  );
}

/** The thumbnail is the first anchor in the row, and the title repeats it. */
function primaryHref(html: string): string {
  return html.match(/<article[\s\S]*?<a href="([^"]+)"/)?.[1] ?? "";
}

describe("ListingRow: where the thumbnail and title point", () => {
  it("sends an active listing to its public page", () => {
    expect(primaryHref(render("active"))).toBe(BROWSE_HREF);
  });

  it("sends a sold listing to its public page, which still resolves", () => {
    expect(primaryHref(render("sold"))).toBe(BROWSE_HREF);
  });

  it("sends a pending-payment listing to edit, because /browse 404s", () => {
    expect(primaryHref(render("pending_payment"))).toBe(EDIT_HREF);
  });

  it("sends a suspended listing to edit for the same reason", () => {
    // The public select policy is status in ('active','sold'), so a suspended
    // row's /browse page 404s exactly as a pending one's does.
    const html = render("suspended", {
      suspension_slug: "image-policy",
      suspension_reason: "image-policy",
    });
    expect(primaryHref(html)).toBe(EDIT_HREF);
    expect(html).not.toContain(BROWSE_HREF);
  });
});

describe("ListingRow: suspended state", () => {
  it("offers neither View nor Remove, and explains itself", () => {
    const html = render("suspended", {
      suspension_slug: "image-policy",
      suspension_reason: "image-policy",
    });

    expect(html).not.toContain("View listing");
    expect(html).not.toContain("remove-listing");
    expect(html).toContain("Suspended by moderation.");
    expect(html).toContain("The photos do not meet our image guidelines.");
  });

  it("shows the operator's note when one was left", () => {
    const html = render("suspended", {
      suspension_slug: "other",
      suspension_reason: "The seller account was banned.",
    });
    expect(html).toContain("The seller account was banned.");
  });

  it("keeps Remove on every other status", () => {
    for (const status of [
      "active",
      "sold",
      "removed",
      "pending_payment",
    ] as ListingStatus[]) {
      expect(render(status), status).toContain("remove-listing");
    }
  });
});
