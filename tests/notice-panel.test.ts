import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchX } from "lucide-react";

import NoticePanel from "@/components/NoticePanel";

const BASE = {
  icon: SearchX,
  title: "Listing not found",
  description: "It may have been removed.",
  href: "/browse",
  linkLabel: "Browse gowns",
};

function render(props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    React.createElement(NoticePanel, { ...BASE, ...props }),
  );
}

describe("NoticePanel", () => {
  it("keeps its default spacing and adds no extra slots when none are given", () => {
    const html = render();

    expect(html).toContain('class="mx-auto mt-16 max-w-md text-center sm:mt-24"');
    expect(html).not.toContain("border-t");
  });

  it("renders children between the description and the primary link", () => {
    const html = render({
      children: React.createElement("ul", { id: "extra" }, "Rules"),
    });

    const descriptionAt = html.indexOf("It may have been removed.");
    const childrenAt = html.indexOf('id="extra"');
    const linkAt = html.indexOf("Browse gowns");
    expect(descriptionAt).toBeLessThan(childrenAt);
    expect(childrenAt).toBeLessThan(linkAt);
  });

  it("renders the footnote after the actions, above a hairline divider", () => {
    const html = render({
      footnote: "Terms apply.",
      secondaryHref: "/",
      secondaryLinkLabel: "Home",
    });

    expect(html.indexOf("Home")).toBeLessThan(html.indexOf("Terms apply."));
    expect(html).toMatch(/<p class="[^"]*border-t[^"]*">Terms apply\.<\/p>/);
  });

  it("lets a caller override the top margin", () => {
    const html = render({ className: "mt-0 sm:mt-0" });

    expect(html).toContain("mt-0");
    expect(html).not.toContain("mt-16");
    expect(html).not.toContain("sm:mt-24");
  });
});
