import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Store } from "lucide-react";

import { AdminExternalLink } from "@/app/(admin)/AdminExternalLink";
import { ListingHeaderMeta } from "@/app/(admin)/admin/listings/[id]/ListingHeaderMeta";

import type { AdminListingStatus } from "@/lib/admin/types";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";

describe("AdminExternalLink", () => {
  it("opens its href in a new tab, safely", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminExternalLink, { href: "/browse", children: "Go" }),
    );

    expect(html).toContain('href="/browse"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("gap-1.5");
  });

  it("renders a leading icon only when given one", () => {
    const link = (props: { icon?: typeof Store }) =>
      React.createElement(AdminExternalLink, {
        href: "/browse",
        children: "Go",
        ...props,
      });

    const bare = renderToStaticMarkup(link({}));
    const withIcon = renderToStaticMarkup(link({ icon: Store }));

    expect(bare.match(/<svg/g)).toHaveLength(1);
    expect(withIcon.match(/<svg/g)).toHaveLength(2);
    expect(withIcon.indexOf("lucide-store")).toBeLessThan(withIcon.indexOf("Go"));
  });
});

describe("ListingHeaderMeta", () => {
  const render = (status: AdminListingStatus) =>
    renderToStaticMarkup(
      React.createElement(ListingHeaderMeta, {
        listingId: LISTING_ID,
        status,
        priceSummary: "$1,200",
      }),
    );

  it.each(["active", "sold"] as const)(
    "links a %s listing to its public page",
    (status) => {
      const html = render(status);
      expect(html).toContain(`href="/browse/${LISTING_ID}"`);
      expect(html).toContain("View listing");
      expect(html.indexOf("$1,200")).toBeLessThan(html.indexOf("View listing"));
    },
  );

  it.each(["pending_payment", "suspended", "removed"] as const)(
    "offers no link for a %s listing, whose public page 404s",
    (status) => {
      const html = render(status);
      expect(html).not.toContain("/browse/");
      expect(html).not.toContain("View listing");
    },
  );
});
