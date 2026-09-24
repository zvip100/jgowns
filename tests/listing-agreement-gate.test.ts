import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement } from "react";

const { hookState } = vi.hoisted(() => ({
  hookState: {
    states: [] as unknown[],
    stateIndex: 0,
    refs: [] as { current: unknown }[],
    refIndex: 0,
    layoutEffectCleanups: [] as (() => void)[],
  },
}));

/** Minimal hook harness: state and refs persist across renders. */
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useLayoutEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) hookState.layoutEffectCleanups.push(cleanup);
    },
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refIndex++;
      if (!(index in hookState.refs)) hookState.refs[index] = { current: initial };
      return hookState.refs[index] as { current: Value };
    },
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
  hookState.refIndex = 0;
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

function markListingCreated(): void {
  resetRender();
  const tree = ListingAgreementGate({ children: FORM }) as ReactElement<{
    value: () => void;
  }>;
  tree.props.value();
}

/** Simulates Activity hiding the route, which runs layout-effect cleanups. */
function hideRoute(): void {
  for (const cleanup of hookState.layoutEffectCleanups.splice(0)) cleanup();
}

function pageShow(isPersisted: boolean): void {
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: isPersisted }));
}

beforeEach(() => {
  hideRoute();
  hookState.states = [];
  hookState.refs = [];
  hookState.layoutEffectCleanups = [];
  vi.stubGlobal("window", new EventTarget());
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

  it("keeps the agreement and draft when the route hides without a created listing", () => {
    clickIAgree();
    render();
    hideRoute();

    expect(render()).toContain("listing-form");
  });

  it("returns to the standards after a created listing once the route hides", () => {
    clickIAgree();
    markListingCreated();
    hideRoute();
    const html = render();

    expect(html).toContain("Our Listing Standards");
    expect(html).not.toContain("listing-form");
  });

  it("returns to the standards when bfcache restores the page after a create", () => {
    clickIAgree();
    markListingCreated();
    pageShow(true);

    expect(render()).toContain("Our Listing Standards");
  });

  it("keeps the draft on a bfcache restore without a created listing", () => {
    clickIAgree();
    render();
    pageShow(true);

    expect(render()).toContain("listing-form");
  });

  it("ignores a normal page load after a create", () => {
    clickIAgree();
    markListingCreated();
    pageShow(false);

    expect(render()).toContain("listing-form");
  });

  it("resets on re-show when the create commits after the route was hidden", () => {
    clickIAgree();
    render();
    hideRoute();
    markListingCreated();
    render();

    expect(render()).toContain("Our Listing Standards");
  });

  it("resets only once per created listing", () => {
    clickIAgree();
    markListingCreated();
    hideRoute();
    clickIAgree();
    render();
    hideRoute();

    expect(render()).toContain("listing-form");
  });
});
