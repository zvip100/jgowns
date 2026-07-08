import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { mockMarkListingSold, mockMarkSizeSold, mockRemoveListing } = vi.hoisted(
  () => ({
    mockMarkListingSold: vi.fn(),
    mockMarkSizeSold: vi.fn(),
    mockRemoveListing: vi.fn(),
  }),
);

vi.mock("@/lib/actions/listings", () => ({
  markListingSold: mockMarkListingSold,
  markSizeSold: mockMarkSizeSold,
  removeListing: mockRemoveListing,
}));
vi.mock("@/components/ConfirmActionButton", () => ({
  default: (props: {
    ariaLabel: string;
    buttonLabel?: string;
    description: string;
  }) => `${props.ariaLabel}|${props.buttonLabel ?? ""}|${props.description}`,
}));

import MarkSizeSoldButton from "@/components/MarkSizeSoldButton";
import MarkSoldButton from "@/components/MarkSoldButton";
import RemoveListingButton from "@/components/RemoveListingButton";

const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SIZE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("dashboard listing action buttons", () => {
  it("renders mark-sold as a confirm dialog trigger for active listings", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkSoldButton, {
        id: LISTING_ID,
        status: "active",
        hasMultipleSizes: false,
      }),
    );

    expect(html).toContain("Mark Sold");
    expect(html).toContain("Mark as sold");
    expect(html).toContain("This will mark the listing as sold.");
    expect(html).not.toContain("all sizes");
    expect(mockMarkListingSold).not.toHaveBeenCalled();
  });

  it("uses concise all-sizes copy for multi-size listing sold confirmation", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkSoldButton, {
        id: LISTING_ID,
        status: "active",
        hasMultipleSizes: true,
      }),
    );

    expect(html).toContain(
      "This will mark the listing and all sizes as sold.",
    );
  });

  it("does not render mark-sold for listings that are not active", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkSoldButton, {
        id: LISTING_ID,
        status: "sold",
        hasMultipleSizes: false,
      }),
    );

    expect(html).toBe("");
  });

  it("renders the remove listing confirm dialog trigger", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemoveListingButton, { id: LISTING_ID }),
    );

    expect(html).toContain("Remove");
    expect(html).toContain("Remove listing");
    expect(mockRemoveListing).not.toHaveBeenCalled();
  });

  it("renders the size-level mark-sold confirm dialog trigger", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkSizeSoldButton, {
        listingId: LISTING_ID,
        sizeId: SIZE_ID,
        size: "8",
      }),
    );

    expect(html).toContain("Mark size 8 as sold");
    expect(mockMarkSizeSold).not.toHaveBeenCalled();
  });
});
