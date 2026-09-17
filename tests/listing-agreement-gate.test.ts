import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement } from "react";

const { hookState } = vi.hoisted(() => ({
  hookState: {
    states: [] as unknown[],
    stateIndex: 0,
  },
}));

/** Minimal hook harness: state persists across renders. */
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <State>(initial: State): [State, (next: State) => void] => {
      const index = hookState.stateIndex++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      return [
        hookState.states[index] as State,
        (next: State) => {
          hookState.states[index] = next;
        },
      ];
    },
  };
});

import ListingAgreementGate from "@/app/(main)/dashboard/new/ListingAgreementGate";

type PrimaryActionProps = { onClick: () => void; children: string };

const FORM = React.createElement("form", { id: "listing-form" }, "Listing form");

function resetRender(): void {
  hookState.stateIndex = 0;
}

function render(): string {
  resetRender();
  return renderToStaticMarkup(
    React.createElement(ListingAgreementGate, null, FORM),
  );
}

function clickIAgree(): void {
  resetRender();
  const tree = ListingAgreementGate({ children: FORM }) as ReactElement<{
    primaryAction: ReactElement<PrimaryActionProps>;
  }>;
  const button = tree.props.primaryAction;
  expect(button.props.children).toBe("I Agree");
  button.props.onClick();
}

beforeEach(() => {
  hookState.states = [];
});

describe("ListingAgreementGate", () => {
  it("shows the listing standards and hides the form until the seller agrees", () => {
    const html = render();

    expect(html).toContain("Our Listing Standards");
    expect(html).toContain("Modest photos only.");
    expect(html).toContain("Crop couple photos.");
    expect(html).toContain("I Agree");
    expect(html).toContain("doesn&#x27;t match our values.");
    expect(html).not.toContain("listing-form");
  });

  it("swaps the notice for the form once the seller clicks I Agree", () => {
    clickIAgree();
    const html = render();

    expect(html).toContain("listing-form");
    expect(html).not.toContain("Our Listing Standards");
    expect(html).not.toContain("I Agree");
  });
});
