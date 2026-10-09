import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditEntrySummary } from "@/app/(admin)/AuditEntrySummary";

describe("AuditEntrySummary", () => {
  it("renders the actor glyph, the action pill, then the row's details", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuditEntrySummary,
        { entry: { actor_role: "seller", action: "listing.create" } },
        React.createElement("p", null, "Ivory gown"),
      ),
    );

    expect(html).toContain("lucide-user");
    expect(html).toContain("Listing created");
    expect(html.indexOf("lucide-user")).toBeLessThan(html.indexOf("Listing created"));
    expect(html.indexOf("Listing created")).toBeLessThan(html.indexOf("Ivory gown"));
  });

  it("marks a system row with the server glyph", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditEntrySummary, {
        entry: { actor_role: "system", action: "listing.purge" },
      }),
    );

    expect(html).toContain("lucide-server");
  });
});
