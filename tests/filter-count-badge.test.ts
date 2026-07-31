import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import FilterCountBadge from "@/app/(main)/browse/FilterCountBadge";

const render = (count: number): string =>
  renderToStaticMarkup(React.createElement(FilterCountBadge, { count }));

describe("FilterCountBadge", () => {
  it("renders the count when there are active filters", () => {
    expect(render(3)).toContain(">3<");
  });

  it("renders nothing when the count is zero", () => {
    expect(render(0)).toBe("");
  });

  it("renders nothing for a negative count", () => {
    expect(render(-1)).toBe("");
  });
});
