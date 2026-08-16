import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { AdminListPage } from "@/app/(admin)/AdminListPage";
import { AdminListSkeleton } from "@/app/(admin)/AdminListSkeleton";
import { AdminPageHeader } from "@/app/(admin)/AdminPageHeader";
import {
  AdminResultCount,
  formatResultCount,
} from "@/app/(admin)/AdminResultCount";

describe("AdminPageHeader", () => {
  it("renders the eyebrow, title, and description", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminPageHeader, {
        eyebrow: "Admin",
        title: "Listings",
        description: "12 listings",
      }),
    );

    expect(html).toContain("Admin");
    expect(html).toContain("<h1");
    expect(html).toContain("Listings");
    expect(html).toContain("12 listings");
  });

  it("omits the description paragraph when none is given", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminPageHeader, {
        eyebrow: "Admin",
        title: "Overview",
      }),
    );

    expect(html).toContain("Overview");
    expect(html).not.toContain("text-(--muted-ink)");
  });

  it("defaults to the page variant's larger title and bottom alignment", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminPageHeader, {
        eyebrow: "Admin",
        title: "Payments",
      }),
    );

    expect(html).toContain("text-[2rem]");
    expect(html).toContain("sm:text-[2.4rem]");
    expect(html).toContain("sm:items-end");
  });

  it("drops a size and aligns to the top in the detail variant", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminPageHeader, {
        eyebrow: "User",
        title: "seller@example.com",
        variant: "detail",
      }),
    );

    expect(html).toContain("text-[1.75rem]");
    expect(html).toContain("sm:text-[2.1rem]");
    expect(html).toContain("sm:items-start");
    expect(html).not.toContain("sm:items-end");
  });

  it("renders a trailing action and a meta row from children", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AdminPageHeader,
        {
          eyebrow: "Listing",
          title: "Ivory A-line",
          variant: "detail",
          action: React.createElement("a", { href: "/edit" }, "Edit listing"),
        },
        React.createElement("span", null, "Active"),
      ),
    );

    expect(html).toContain("Edit listing");
    expect(html).toContain("Active");
  });
});

describe("formatResultCount", () => {
  it("keeps the noun singular for exactly one", () => {
    expect(formatResultCount(1, "listing")).toBe("1 listing");
  });

  it("adds an s for zero and for many", () => {
    expect(formatResultCount(0, "listing")).toBe("0 listings");
    expect(formatResultCount(12, "user")).toBe("12 users");
  });

  it("uses an explicit plural when one is given", () => {
    expect(formatResultCount(3, "entry", "entries")).toBe("3 entries");
    expect(formatResultCount(1, "entry", "entries")).toBe("1 entry");
  });
});

describe("AdminResultCount", () => {
  it("shows a counting fallback while the count resolves", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminResultCount, {
        countPromise: new Promise<number>(() => {}),
        noun: "listing",
      }),
    );

    expect(html).toContain("Counting listings...");
  });

  it("uses the explicit plural in the fallback too", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminResultCount, {
        countPromise: new Promise<number>(() => {}),
        noun: "entry",
        pluralNoun: "entries",
      }),
    );

    expect(html).toContain("Counting entries...");
  });
});

describe("AdminListPage", () => {
  const pending = <T,>() => new Promise<T>(() => {});

  it("paints the header while the body and the count are still pending", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminListPage, {
        basePath: "/admin/listings",
        title: "Listings",
        countNoun: "listing",
        searchPlaceholder: "Search by title",
        headers: ["Listing"],
        emptyTitle: "No listings match",
        emptyDescription: "Try clearing filters.",
        resultPromise: pending<never>(),
        renderRow: () => null,
      }),
    );

    expect(html).toContain("Listings");
    expect(html).toContain("Counting listings...");
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("Search by title");
  });

  it("puts a description prefix ahead of the count", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminListPage, {
        basePath: "/admin/messages",
        title: "Messages",
        countNoun: "message",
        descriptionPrefix: "Read-only inbox · ",
        searchPlaceholder: "Search by email",
        headers: ["Email"],
        emptyTitle: "No messages match",
        emptyDescription: "Try clearing filters.",
        resultPromise: pending<never>(),
        renderRow: () => null,
      }),
    );

    expect(html).toContain("Read-only inbox ");
    expect(html).toContain("Counting messages...");
  });
});

describe("AdminListSkeleton", () => {
  it("renders decorative pulsing blocks only", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminListSkeleton),
    );

    expect(html).toContain("animate-pulse");
    expect(html).toContain('aria-hidden="true"');
  });
});
