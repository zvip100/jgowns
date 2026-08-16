import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreditCard, Mail, Shirt, Users } from "lucide-react";
import { describe, it, expect } from "vitest";

import { StatCluster } from "@/app/(admin)/StatCluster";

describe("StatCluster", () => {
  it("labels the group and renders every item as a term and definition", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Inventory",
        icon: Shirt,
        tone: "inventory",
        items: [
          { label: "Active", value: 2 },
          { label: "Sold", value: 1 },
        ],
      }),
    );

    expect(html).toContain('aria-label="Inventory"');
    expect(html).toContain("Inventory");
    expect(html).toContain("Active");
    expect(html).toContain("Sold");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
  });

  it("renders a string value such as a formatted amount unchanged", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Fees",
        icon: CreditCard,
        tone: "money",
        items: [{ label: "Collected (7d)", value: "$5.00" }],
      }),
    );

    expect(html).toContain("$5.00");
  });

  it("renders a hint only for the item that carries one", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Inbox",
        icon: Mail,
        tone: "attention",
        items: [
          { label: "Oldest message", value: "6d", hint: "Age of the oldest" },
        ],
      }),
    );

    expect(html).toContain("Age of the oldest");

    const withoutHint = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Inbox",
        icon: Mail,
        tone: "attention",
        items: [{ label: "Oldest message", value: "6d" }],
      }),
    );

    expect(withoutHint).not.toContain("Age of the oldest");
  });

  it("gives each tone its own header colour", () => {
    const tones = {
      inventory: "text-(--accent-deep)",
      money: "text-[#2d7a4f]",
      people: "text-(--muted-ink)",
      attention: "text-(--sold)",
    } as const;

    for (const [tone, expected] of Object.entries(tones)) {
      const html = renderToStaticMarkup(
        React.createElement(StatCluster, {
          label: "Group",
          icon: Users,
          tone: tone as keyof typeof tones,
          items: [{ label: "Count", value: 1 }],
        }),
      );

      expect(html).toContain(expected);
    }
  });

  it("skips the two-column step for odd counts, which would strand an empty half", () => {
    const even = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Inventory",
        icon: Shirt,
        tone: "inventory",
        items: [
          { label: "Active", value: 2 },
          { label: "Sold", value: 1 },
          { label: "Off market", value: 2 },
          { label: "Total gowns", value: 10 },
        ],
      }),
    );

    expect(even).toContain("@min-[15rem]:grid-cols-2");

    const odd = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Fees",
        icon: CreditCard,
        tone: "money",
        items: [
          { label: "Collected", value: "$5.00" },
          { label: "Unpaid", value: 1 },
          { label: "Stuck", value: 1 },
        ],
      }),
    );

    expect(odd).not.toContain("@min-[15rem]:grid-cols-2");
  });

  it("does not spread a lone item across auto columns", () => {
    const single = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "Inbox",
        icon: Mail,
        tone: "attention",
        items: [{ label: "Oldest message", value: "6d" }],
      }),
    );

    expect(single).not.toContain("grid-flow-col");

    const pair = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "People",
        icon: Users,
        tone: "people",
        items: [
          { label: "Users", value: 5 },
          { label: "New (7d)", value: 0 },
        ],
      }),
    );

    expect(pair).toContain("grid-flow-col");
  });

  it("applies the page's column span from className", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatCluster, {
        label: "People",
        icon: Users,
        tone: "people",
        className: "col-span-1 md:col-span-6 lg:col-span-4",
        items: [{ label: "Users", value: 5 }],
      }),
    );

    expect(html).toContain("md:col-span-6");
    expect(html).toContain("lg:col-span-4");
  });
});
