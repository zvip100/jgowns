import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { ContactMethod } from "@/lib/types";

type CheckboxProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
};

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, checked, disabled }: CheckboxProps) =>
    React.createElement("input", {
      type: "checkbox",
      id,
      defaultChecked: checked,
      disabled,
    }),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ htmlFor, children }: { htmlFor: string; children: ReactNode }) =>
    React.createElement("label", { htmlFor }, children),
}));

import { ContactMethodsField } from "@/components/form/ContactMethodsField";

function render(props: {
  value: ContactMethod[];
  disabled?: boolean;
}): string {
  return renderToStaticMarkup(
    React.createElement(ContactMethodsField, { onToggle: () => {}, ...props }),
  );
}

describe("ContactMethodsField", () => {
  it("offers every method with the stored ones checked", () => {
    const html = render({ value: ["text"] });

    expect(html).toContain(">Call<");
    expect(html).toContain(">Text<");
    expect(html).toContain('id="contact-method-text" checked=""');
    expect(html).not.toContain('id="contact-method-call" checked=""');
  });

  it("checks nothing when no method is stored", () => {
    expect(render({ value: [] })).not.toContain('checked=""');
  });

  it("goes inert without a phone number, which is what the row check requires", () => {
    const html = render({ value: [], disabled: true });
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("stays interactive once there is a number to act on", () => {
    expect(render({ value: ["call", "text"] })).not.toContain('disabled=""');
  });
});
