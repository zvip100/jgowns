import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { beginRender, expand, findAll, resetHarness, runEffects } from "./support/react-hook-harness";

import type { ReactNode } from "react";

type ActionState = { error?: string } | null;

const { action, mockCreateListingCheckout, mockToastError } = vi.hoisted(() => ({
  action: { run: null as (() => unknown) | null, state: null as ActionState },
  mockCreateListingCheckout: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("react", async () => {
  const mocked = (await import("./support/react-hook-harness")).mockReact(await vi.importActual("react"));
  return {
    ...mocked,
    useActionState: (run: () => unknown) => {
      action.run = run;
      return [action.state, () => {}, false];
    },
  };
});
vi.mock("@/components/ui/button", () => ({
  Button: (props: Record<string, unknown> & { children: ReactNode }) => React.createElement("button", props),
}));
vi.mock("@/lib/actions/payments", () => ({ createListingCheckout: mockCreateListingCheckout }));
vi.mock("@/lib/toast", () => ({ toast: { error: mockToastError } }));

import PublishListingButton from "@/components/PublishListingButton";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";

function render(props: { label: string; isFeeWaived?: boolean }) {
  beginRender();
  return expand(React, React.createElement(PublishListingButton, { listingId: LISTING_ID, ...props }));
}

beforeEach(() => {
  resetHarness();
  action.run = null;
  action.state = null;
  mockCreateListingCheckout.mockReset();
  mockToastError.mockReset();
});

describe("PublishListingButton", () => {
  it("asks for Checkout by default", async () => {
    render({ label: "Complete Payment" });
    await action.run?.();
    expect(mockCreateListingCheckout).toHaveBeenCalledWith(LISTING_ID, false);
  });

  it("requests the fee waiver as Publish for free", async () => {
    render({ label: "Publish for free", isFeeWaived: true });
    await action.run?.();
    expect(mockCreateListingCheckout).toHaveBeenCalledWith(LISTING_ID, true);
  });

  it("names the icon-only row button by its label", () => {
    const tree = render({ label: "Publish for free", isFeeWaived: true });
    expect(findAll(React, tree, (props) => props["aria-label"] === "Publish for free")).toHaveLength(1);
  });

  it("titles a failure by what was attempted", () => {
    action.state = { error: "Payment is completing. Refresh and try again." };
    render({ label: "Publish for free", isFeeWaived: true });
    runEffects();
    expect(mockToastError).toHaveBeenCalledWith("Couldn't publish listing", {
      description: "Payment is completing. Refresh and try again.",
    });

    resetHarness();
    action.state = { error: "Your listing is saved. Please retry payment." };
    render({ label: "Complete Payment" });
    runEffects();
    expect(mockToastError).toHaveBeenLastCalledWith("Couldn't start checkout", {
      description: "Your listing is saved. Please retry payment.",
    });
  });

  // Activity hides a route instead of unmounting it, then re-runs its effects
  // when the route shows again with the same action state.
  it("toasts each result once, not again when the page shows again", () => {
    action.state = { error: "Something went wrong. Please try again." };
    render({ label: "Complete Payment" });
    runEffects();
    render({ label: "Complete Payment" });
    runEffects();
    expect(mockToastError).toHaveBeenCalledOnce();

    action.state = { error: "Something went wrong. Please try again." };
    render({ label: "Complete Payment" });
    runEffects();
    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the action has not failed", () => {
    render({ label: "Complete Payment" });
    runEffects();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
