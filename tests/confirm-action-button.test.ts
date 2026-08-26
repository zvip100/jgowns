import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Ban } from "lucide-react";

import type { ReactNode } from "react";

type TriggerState = { error: string | null; isPending: boolean };

const { dialogProps, mockDialogState } = vi.hoisted(() => ({
  dialogProps: [] as Record<string, unknown>[],
  mockDialogState: { isPending: false },
}));

/**
 * Only the trigger is under test, so the dialog is reduced to the slot that
 * renders it. The dialog's own pending and error handling is exercised through
 * the call sites, not here. `mockDialogState.isPending` lets one test simulate
 * the pending state without a real dialog.
 */
vi.mock("@/components/ConfirmActionDialog", () => ({
  default: (props: {
    renderTrigger: (state: TriggerState) => ReactNode;
  }) => {
    dialogProps.push(props);
    return props.renderTrigger({
      error: null,
      isPending: mockDialogState.isPending,
    });
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: { children?: ReactNode } & Record<string, unknown>) =>
    React.createElement("button", props, children),
}));

import ConfirmActionButton from "@/components/ConfirmActionButton";

const BASE = {
  title: "Suspend listing?",
  description: "The seller sees a moderation notice.",
  confirmLabel: "Suspend",
  pendingLabel: "Suspending...",
  ariaLabel: "Suspend listing",
  icon: Ban,
  triggerClassName: "trigger",
  onConfirm: async () => ({}),
};

function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(ConfirmActionButton, { ...BASE, ...props }),
  );
}

describe("ConfirmActionButton: live trigger", () => {
  it("is enabled and titled with its aria label by default", () => {
    const html = render({});
    expect(html).not.toContain("disabled");
    expect(html).toContain('title="Suspend listing"');
  });

  it("is enabled by default in the inline-icon style too", () => {
    const html = render({ triggerStyle: "inline-icon" });
    expect(html).not.toContain("disabled");
  });
});

describe("ConfirmActionButton: inert trigger", () => {
  it("renders disabled and says why, so a demo screen never offers the write", () => {
    const html = render({
      disabled: true,
      disabledTitle: "Turn off demo mode to make changes.",
    });

    expect(html).toContain("disabled");
    expect(html).toContain('title="Turn off demo mode to make changes."');
  });

  it("does the same for the inline-icon style", () => {
    const html = render({
      triggerStyle: "inline-icon",
      disabled: true,
      disabledTitle: "Turn off demo mode to make changes.",
    });

    expect(html).toContain("disabled");
    expect(html).toContain('title="Turn off demo mode to make changes."');
  });

  it("keeps the aria label when disabled without an explanation", () => {
    const html = render({ disabled: true });
    expect(html).toContain("disabled");
    expect(html).toContain('title="Suspend listing"');
  });
});

describe("ConfirmActionButton: the inert inline-icon trigger looks inert", () => {
  it("dims the raw button, which shadcn's Button does for itself", () => {
    const html = render({ triggerStyle: "inline-icon", disabled: true });
    expect(html).toContain("opacity-50");
  });

  it("does not dim it while an action is merely pending", () => {
    mockDialogState.isPending = true;
    try {
      expect(
        render({ triggerStyle: "inline-icon" }),
      ).not.toContain("opacity-50");
    } finally {
      mockDialogState.isPending = false;
    }
  });
});

describe("ConfirmActionButton: the validate gate", () => {
  it("forwards validate to the dialog, which is what keeps a field error off the banner", () => {
    dialogProps.length = 0;
    const validate = () => false;
    render({ validate });

    expect(dialogProps).toHaveLength(1);
    expect(dialogProps[0].validate).toBe(validate);
  });

  it("passes nothing when the action has no field-level input", () => {
    dialogProps.length = 0;
    render({});
    expect(dialogProps[0].validate).toBeUndefined();
    expect(dialogProps[0].onOpen).toBeUndefined();
  });

  it("forwards onOpen, so a reopened dialog is not still showing the last attempt", () => {
    dialogProps.length = 0;
    const onOpen = () => {};
    render({ onOpen });
    expect(dialogProps[0].onOpen).toBe(onOpen);
  });
});
