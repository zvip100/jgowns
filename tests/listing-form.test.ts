import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  EMPTY_LISTING_ERRORS,
  hasListingFieldErrors,
  listingFormActionError,
  listingRowPayload,
  parseJsonFormValue,
  rawListingFieldsFromFormData,
  strOrUndefined,
  toggleContactMethod,
  variantRowsPayload,
  zodListingFormErrorMessage,
} from "@/lib/listing-form";
import { listingInputSchema } from "@/lib/validations/listing-schema";

import type { ParsedListing } from "@/lib/validations/listing-schema";

/**
 * These moved out of `actions/sell.ts` so the admin edit action could share
 * them: a `"use server"` module may only export async server actions, so
 * neither file could have shared them directly.
 */

function parse(overrides: Record<string, unknown> = {}): ParsedListing {
  return listingInputSchema.parse({
    title: "Ivory lace gown",
    location: "Monsey",
    condition: "Brand New",
    category: "bridal",
    sizes: [{ size: "8", size_group: "adult", price: 400 }],
    contact_email: "seller@example.com",
    contact_methods: [],
    ...overrides,
  });
}

describe("strOrUndefined", () => {
  it("trims a real value", () => {
    expect(strOrUndefined("  hello  ")).toBe("hello");
  });

  it("returns undefined for blank, whitespace, null, and a File", () => {
    expect(strOrUndefined("")).toBeUndefined();
    expect(strOrUndefined("   ")).toBeUndefined();
    expect(strOrUndefined(null)).toBeUndefined();
    expect(strOrUndefined(new File([], "a.jpg"))).toBeUndefined();
  });
});

describe("parseJsonFormValue", () => {
  it("parses valid JSON", () => {
    expect(parseJsonFormValue('[{"size":"8"}]')).toEqual([{ size: "8" }]);
  });

  it("passes invalid JSON through unchanged so zod rejects it", () => {
    expect(parseJsonFormValue("not json")).toBe("not json");
  });

  it("returns undefined for a missing or non-string field", () => {
    expect(parseJsonFormValue(null)).toBeUndefined();
    expect(parseJsonFormValue(new File([], "a.jpg"))).toBeUndefined();
  });
});

describe("rawListingFieldsFromFormData", () => {
  it("reads every listing field, decoding the two JSON-encoded ones", () => {
    const formData = new FormData();
    formData.set("title", "Ivory lace gown");
    formData.set("description", "  Worn once.  ");
    formData.set("location", "Monsey");
    formData.set("condition", "Brand New");
    formData.set("category", "bridal");
    formData.set("sizes", '[{"size":"8","size_group":"adult","price":400}]');
    formData.set("contact_methods", '["call"]');
    formData.set("color", "   ");

    const raw = rawListingFieldsFromFormData(formData);
    expect(raw.title).toBe("Ivory lace gown");
    expect(raw.description).toBe("Worn once.");
    expect(raw.sizes).toEqual([
      { size: "8", size_group: "adult", price: 400 },
    ]);
    expect(raw.contact_methods).toEqual(["call"]);
    // A field left blank reads as absent, not as an empty string.
    expect(raw.color).toBeUndefined();
  });
});

describe("variantRowsPayload", () => {
  it("orders sizes canonically and numbers sort_order from zero", () => {
    const rows = variantRowsPayload(
      parse({
        sizes: [
          { size: "12", size_group: "adult", price: 300 },
          { size: "8", size_group: "adult", price: 400 },
        ],
      }),
    );
    expect(rows.map((r) => r.size)).toEqual(["8", "12"]);
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1]);
  });

  it("mirrors the set price onto every variant of a set-only listing", () => {
    const rows = variantRowsPayload(
      parse({
        sell_mode: "set_only",
        bundle_price: 900,
        sizes: [
          { size: "8", size_group: "adult" },
          { size: "10", size_group: "adult" },
        ],
      }),
    );
    expect(rows.map((r) => r.price)).toEqual([900, 900]);
  });

  it("keeps per-size prices for every other sell mode", () => {
    const rows = variantRowsPayload(
      parse({
        sell_mode: "either",
        bundle_price: 700,
        sizes: [
          { size: "8", size_group: "adult", price: 400 },
          { size: "10", size_group: "adult", price: 350 },
        ],
      }),
    );
    expect(rows.map((r) => r.price)).toEqual([400, 350]);
  });
});

describe("listingRowPayload", () => {
  it("normalizes absent optionals to null and passes images and status through", () => {
    const payload = listingRowPayload(
      parse(),
      ["https://example.com/a.webp"],
      ["data:image/webp;base64,zz"],
      "suspended",
    );

    expect(payload.description).toBeNull();
    expect(payload.color).toBeNull();
    expect(payload.bundle_price).toBeNull();
    expect(payload.contact_phone).toBeNull();
    expect(payload.image_urls).toEqual(["https://example.com/a.webp"]);
    expect(payload.image_blur_data_urls).toEqual([
      "data:image/webp;base64,zz",
    ]);
    expect(payload.status).toBe("suspended");
  });

  it("omits both image keys entirely when called without images, so the RPC preserves the current arrays", () => {
    const payload = listingRowPayload(parse(), undefined, undefined, "active");

    expect(payload).not.toHaveProperty("image_urls");
    expect(payload).not.toHaveProperty("image_blur_data_urls");
  });
});

describe("zodListingFormErrorMessage", () => {
  function issuesFor(input: Record<string, unknown>): z.ZodError {
    const parsed = listingInputSchema.safeParse(input);
    if (parsed.success) throw new Error("expected a validation failure");
    return parsed.error;
  }

  it("prefers the phone message when the phone is the problem", () => {
    expect(
      zodListingFormErrorMessage(
        issuesFor({
          title: "Ivory lace gown",
          location: "Monsey",
          condition: "Brand New",
          category: "bridal",
          sizes: [{ size: "8", size_group: "adult", price: 400 }],
          contact_phone: "not-a-phone",
        }),
      ),
    ).toBe("Leave phone blank, or enter a valid phone number.");
  });

  it("reports a malformed email in the seller's words", () => {
    expect(
      zodListingFormErrorMessage(
        issuesFor({
          title: "Ivory lace gown",
          location: "Monsey",
          condition: "Brand New",
          category: "bridal",
          sizes: [{ size: "8", size_group: "adult", price: 400 }],
          contact_email: "nope",
        }),
      ),
    ).toBe("Enter a valid email address, or clear the field.");
  });

  it("surfaces a cross-field rule over the generic fallback", () => {
    expect(
      zodListingFormErrorMessage(
        issuesFor({
          title: "Ivory lace gown",
          location: "Monsey",
          condition: "Brand New",
          category: "bridal",
          sizes: [{ size: "8", size_group: "adult", price: 400 }],
        }),
      ),
    ).toBe("Add an email or phone number so buyers can reach you.");
  });

  it("falls back to the generic message when nothing more specific applies", () => {
    expect(
      zodListingFormErrorMessage(
        issuesFor({
          title: "no",
          location: "Monsey",
          condition: "Brand New",
          category: "bridal",
          sizes: [{ size: "8", size_group: "adult", price: 400 }],
          contact_email: "seller@example.com",
        }),
      ),
    ).toBe("Please fill in all required fields.");
  });
});

describe("listingFormActionError", () => {
  it("routes a ZodError through the field-message mapper", () => {
    const parsed = listingInputSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(listingFormActionError(parsed.error).error).toBeTruthy();
  });

  it("uses a thrown Error's own message", () => {
    expect(listingFormActionError(new Error("storage down"))).toEqual({
      error: "storage down",
    });
  });

  it("falls back for a non-Error throw", () => {
    expect(listingFormActionError("boom")).toEqual({
      error: "Something went wrong.",
    });
  });
});

describe("hasListingFieldErrors", () => {
  it("is false for a clean result", () => {
    expect(hasListingFieldErrors(EMPTY_LISTING_ERRORS)).toBe(false);
  });

  it("sees a scalar field message", () => {
    expect(
      hasListingFieldErrors({ fields: { title: "x" }, sizes: [], general: "" }),
    ).toBe(true);
  });

  it("sees a size row message on either half of the row", () => {
    expect(
      hasListingFieldErrors({ fields: {}, sizes: [{ size: "x" }], general: "" }),
    ).toBe(true);
    expect(
      hasListingFieldErrors({ fields: {}, sizes: [{ price: "x" }], general: "" }),
    ).toBe(true);
  });

  it("ignores the general line, which is what separates it from hasListingErrors", () => {
    // The submit path uses this to decide whether the banner should say "fix
    // the highlighted fields", so a general-only error must not count.
    expect(
      hasListingFieldErrors({ fields: {}, sizes: [], general: "boom" }),
    ).toBe(false);
  });

  it("ignores an empty size row left in place by an earlier index", () => {
    expect(
      hasListingFieldErrors({ fields: {}, sizes: [{}, {}], general: "" }),
    ).toBe(false);
  });
});

describe("toggleContactMethod", () => {
  it("adds a method that isn't already present", () => {
    expect(toggleContactMethod([], "call", true)).toEqual(["call"]);
  });

  it("does not duplicate a method that's already present", () => {
    expect(toggleContactMethod(["call"], "call", true)).toEqual(["call"]);
  });

  it("removes a method", () => {
    expect(toggleContactMethod(["call", "text"], "call", false)).toEqual([
      "text",
    ]);
  });

  it("is a no-op removing a method that isn't present", () => {
    expect(toggleContactMethod(["text"], "call", false)).toEqual(["text"]);
  });
});
