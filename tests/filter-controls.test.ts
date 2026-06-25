import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { Accordion } from "@/components/ui/accordion";
import {
  FilterPill,
  FilterSection,
  GroupedSizePills,
  MultiPillGroup,
  SinglePillGroup,
} from "@/app/(main)/browse/filter-controls";

import type { SizeOption } from "@/lib/gown-sizes";

const noop = (): void => {};

const countActive = (html: string): number =>
  html.match(/data-active="true"/g)?.length ?? 0;

describe("FilterPill", () => {
  it("renders its label and active markup when active", () => {
    const html = renderToStaticMarkup(
      React.createElement(FilterPill, {
        active: true,
        onClick: noop,
        children: "Pink",
      }),
    );
    expect(html).toContain("Pink");
    expect(html).toContain('data-active="true"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders idle markup when not active", () => {
    const html = renderToStaticMarkup(
      React.createElement(FilterPill, {
        active: false,
        onClick: noop,
        children: "Pink",
      }),
    );
    expect(html).toContain('data-active="false"');
    expect(html).toContain('aria-pressed="false"');
  });
});

describe("MultiPillGroup", () => {
  const options = [
    { value: "Pink", label: "Pink" },
    { value: "White", label: "White" },
    { value: "Black", label: "Black" },
  ];

  it("activates only the All pill when nothing is selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(MultiPillGroup, {
        options,
        selected: [],
        onToggle: noop,
        onClear: noop,
        ariaLabel: "Color",
      }),
    );
    expect(html).toContain("All");
    expect(html).toContain("Pink");
    expect(countActive(html)).toBe(1);
  });

  it("activates every selected option (multi-select)", () => {
    const html = renderToStaticMarkup(
      React.createElement(MultiPillGroup, {
        options,
        selected: ["Pink", "White"],
        onToggle: noop,
        onClear: noop,
        ariaLabel: "Color",
      }),
    );
    expect(countActive(html)).toBe(2);
  });
});

describe("SinglePillGroup", () => {
  const options = [
    { value: "no-alterations", label: "Ready to Wear" },
    { value: "Brand New", label: "Brand New Only" },
  ];

  it("activates the All pill when no value is set", () => {
    const html = renderToStaticMarkup(
      React.createElement(SinglePillGroup, {
        options,
        value: "",
        onSelect: noop,
        ariaLabel: "Condition",
      }),
    );
    expect(html).toContain("Ready to Wear");
    expect(countActive(html)).toBe(1);
  });

  it("activates exactly the matching option (single-select)", () => {
    const html = renderToStaticMarkup(
      React.createElement(SinglePillGroup, {
        options,
        value: "Brand New",
        onSelect: noop,
        ariaLabel: "Condition",
      }),
    );
    expect(countActive(html)).toBe(1);
    expect(html).toContain("Brand New Only");
  });
});

describe("GroupedSizePills", () => {
  const flatSizes: SizeOption[] = [
    { sizeGroup: "adult", value: "8", label: "8", filterToken: "a:8" },
    { sizeGroup: "adult", value: "10", label: "10", filterToken: "a:10" },
  ];

  const groupedSizes: SizeOption[] = [
    {
      sizeGroup: "adult",
      value: "8",
      label: "8",
      filterToken: "a:8",
      group: "Adult",
    },
    {
      sizeGroup: "kids",
      value: "10",
      label: "10K",
      filterToken: "k:10",
      group: "Kids",
    },
  ];

  it("renders a flat row with an All pill when options have no group", () => {
    const html = renderToStaticMarkup(
      React.createElement(GroupedSizePills, {
        options: flatSizes,
        selected: [],
        onToggle: noop,
        onClear: noop,
        ariaLabel: "Size",
      }),
    );
    expect(html).toContain("All");
    expect(html).toContain(">8<");
    expect(html).toContain(">10<");
    expect(countActive(html)).toBe(1);
  });

  it("renders section headers when options are grouped", () => {
    const html = renderToStaticMarkup(
      React.createElement(GroupedSizePills, {
        options: groupedSizes,
        selected: ["a:8"],
        onToggle: noop,
        onClear: noop,
        ariaLabel: "Size",
      }),
    );
    expect(html).toContain("Adult");
    expect(html).toContain("Kids");
    expect(countActive(html)).toBe(1);
  });
});

describe("FilterSection", () => {
  const renderSection = (count: number): string =>
    renderToStaticMarkup(
      React.createElement(
        Accordion,
        { type: "multiple" },
        React.createElement(FilterSection, {
          value: "color",
          label: "Color",
          count,
          children: "content",
        }),
      ),
    );

  it("shows the label and an 'All' badge when count is 0", () => {
    const html = renderSection(0);
    expect(html).toContain("Color");
    expect(html).toContain("All");
  });

  it("shows the numeric count in the badge when active", () => {
    const html = renderSection(3);
    expect(html).toContain("Color");
    expect(html).toContain(">3<");
  });
});
