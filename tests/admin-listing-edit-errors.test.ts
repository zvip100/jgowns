import { describe, expect, it } from "vitest";

import {
  collectListingFieldErrors,
  rawListingFieldsFromFormData,
} from "@/lib/listing-form";
import { listingInputSchema } from "@/lib/validations/listing-schema";

/**
 * The admin edit form validates by running the action's own parsing path and
 * routing the issues onto its controls, so field messages and the server's
 * authority cannot drift. This exercises that composition without React: the
 * form contributes only the FormData and the rendering.
 */

function formDataFor(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    title: "Ivory lace gown",
    description: "Worn once.",
    color: "Ivory",
    location: "Monsey",
    condition: "Brand New",
    category: "bridal",
    sell_mode: "individual",
    bundle_price: "",
    sizes: JSON.stringify([{ size: "8", size_group: "adult", price: 400 }]),
    contact_email: "seller@example.com",
    contact_phone: "",
    contact_methods: "[]",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function errorsFor(overrides: Record<string, string> = {}) {
  const parsed = listingInputSchema.safeParse(
    rawListingFieldsFromFormData(formDataFor(overrides)),
  );
  if (parsed.success) return null;
  return collectListingFieldErrors(parsed.error.issues);
}

describe("admin edit inline validation", () => {
  it("finds nothing wrong with a complete form", () => {
    expect(errorsFor()).toBeNull();
  });

  it("puts a short title on the title field, not in the banner", () => {
    const errors = errorsFor({ title: "no" });
    expect(errors?.fields.title).toBeTruthy();
    expect(errors?.general).toBe("");
  });

  it("routes each scalar field to its own control", () => {
    expect(errorsFor({ location: "" })?.fields.location).toBeTruthy();
    expect(errorsFor({ condition: "" })?.fields.condition).toBeTruthy();
    expect(errorsFor({ category: "" })?.fields.category).toBeTruthy();
    expect(
      errorsFor({ contact_email: "not-an-email" })?.fields.contact_email,
    ).toBeTruthy();
    expect(errorsFor({ contact_phone: "abc" })?.fields.contact_phone).toBeTruthy();
  });

  it("puts a set price that the sell mode forbids on the price field", () => {
    const errors = errorsFor({ sell_mode: "individual", bundle_price: "500" });
    expect(errors?.fields.bundle_price).toBeTruthy();
    expect(errors?.general).toBe("");
  });

  it("puts a size row's message on that row, keyed by index", () => {
    const errors = errorsFor({
      sizes: JSON.stringify([
        { size: "8", size_group: "adult", price: 400 },
        { size: "10", size_group: "adult", price: 0 },
      ]),
    });
    expect(errors?.sizes[0]).toBeUndefined();
    expect(errors?.sizes[1]?.price).toBeTruthy();
  });

  it("names contact methods without a phone number rather than dropping them", () => {
    // listings_contact_methods_need_phone_check in SQL; the field group has no
    // inline slot, so this is one of the few messages the banner still owns.
    const errors = errorsFor({
      contact_phone: "",
      contact_methods: JSON.stringify(["call"]),
    });
    expect(errors?.general).toBeTruthy();
  });

  it("leaves the banner empty whenever a control can carry the message", () => {
    expect(errorsFor({ title: "no", location: "" })?.general).toBe("");
  });
});
