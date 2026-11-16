import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

type CheckboxProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
};

const { lastCheckbox } = vi.hoisted(() => ({
  lastCheckbox: { props: null as CheckboxProps | null },
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: CheckboxProps) => {
    lastCheckbox.props = props;
    return React.createElement("input", {
      type: "checkbox",
      id: props.id,
      defaultChecked: props.checked,
      disabled: props.disabled,
      className: props.className,
    });
  },
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ htmlFor, children }: { htmlFor: string; children: ReactNode }) =>
    React.createElement("label", { htmlFor }, children),
}));

import { LabeledCheckbox } from "@/components/form/LabeledCheckbox";
import { CHECKBOX_GOLD_CLASS } from "@/lib/styles";

function render(
  props: Partial<React.ComponentProps<typeof LabeledCheckbox>> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(LabeledCheckbox, {
      id: "publish-for-free",
      label: "Publish for free",
      checked: false,
      onCheckedChange: () => {},
      ...props,
    }),
  );
}

describe("LabeledCheckbox", () => {
  it("ties the label to the box and paints it gold", () => {
    const html = render();

    expect(html).toContain('id="publish-for-free"');
    expect(html).toContain('for="publish-for-free"');
    expect(html).toContain(">Publish for free<");
    expect(lastCheckbox.props?.className).toBe(CHECKBOX_GOLD_CLASS);
  });

  it("reflects the checked and disabled state", () => {
    expect(render()).not.toContain('checked=""');
    expect(render({ checked: true })).toContain('checked=""');
    expect(render({ disabled: true })).toContain('disabled=""');
  });

  it("lets a caller override the default gap", () => {
    const html = render({ className: "gap-2.5" });
    expect(html).toContain('class="flex items-center gap-2.5"');
  });

  it("reports only true as checked, never the indeterminate state", () => {
    const onCheckedChange = vi.fn();
    render({ onCheckedChange });

    lastCheckbox.props?.onCheckedChange(true);
    lastCheckbox.props?.onCheckedChange("indeterminate");
    lastCheckbox.props?.onCheckedChange(false);

    expect(onCheckedChange.mock.calls).toEqual([[true], [false], [false]]);
  });
});
