import { z } from "zod";

import { sizeOptionIndex } from "@/lib/gown-sizes";
import { SIZE_GROUPS, type ContactMethod, type ListingStatus } from "@/lib/types";

import type { ParsedListing } from "@/lib/validations/listing-schema";

/**
 * Pure listing-form helpers, shared by the seller actions in `actions/sell.ts`
 * and the admin edit action in `actions/admin/listings.ts`. They live outside
 * both because a `"use server"` module may only export async server actions,
 * so neither file can share them directly.
 */

export type VariantRow = {
  size: string;
  size_group: (typeof SIZE_GROUPS)[number];
  price: number;
  sort_order: number;
};

/**
 * Submitted sizes in canonical category order, with sort_order assigned.
 * Set-only variants mirror the one bundle price so the variant-level browse
 * price filter can treat the set as a single-priced item; every other mode
 * keeps its own per-size price.
 */
export function variantRowsPayload(parsed: ParsedListing): VariantRow[] {
  const setPrice = parsed.sell_mode === "set_only" ? parsed.bundle_price : null;
  return [...parsed.sizes]
    .sort(
      (a, b) =>
        sizeOptionIndex(parsed.category, a.size_group, a.size) -
        sizeOptionIndex(parsed.category, b.size_group, b.size),
    )
    .map((entry, i) => ({
      size: entry.size,
      size_group: entry.size_group,
      price: setPrice ?? entry.price ?? 0,
      sort_order: i,
    }));
}

export function strOrUndefined(
  value: FormDataEntryValue | null,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** JSON-encoded form field; invalid JSON is passed through so zod rejects it. */
export function parseJsonFormValue(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function rawListingFieldsFromFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    description: strOrUndefined(formData.get("description")),
    color: strOrUndefined(formData.get("color")),
    location: formData.get("location"),
    condition: formData.get("condition"),
    category: formData.get("category"),
    sizes: parseJsonFormValue(formData.get("sizes")),
    sell_mode: strOrUndefined(formData.get("sell_mode")),
    bundle_price: strOrUndefined(formData.get("bundle_price")),
    contact_email: strOrUndefined(formData.get("contact_email")),
    contact_phone: strOrUndefined(formData.get("contact_phone")),
    contact_methods: parseJsonFormValue(formData.get("contact_methods")),
  };
}

/** Toggle one method in/out of the seller's chosen contact-methods set. */
export function toggleContactMethod(
  prev: ContactMethod[],
  method: ContactMethod,
  checked: boolean,
): ContactMethod[] {
  if (checked) return prev.includes(method) ? prev : [...prev, method];
  return prev.filter((m) => m !== method);
}

/**
 * `image_urls`/`image_blur_data_urls` are omitted (not passed) by the admin
 * edit path, which never intends to touch photos: leaving the keys out of the
 * jsonb payload lets `update_listing_with_variants` preserve the row's current
 * arrays inside its own transaction, rather than the caller re-reading them
 * and risking a stale overwrite (see migration 033).
 */
export function listingRowPayload(
  parsed: ParsedListing,
  image_urls: string[] | undefined,
  image_blur_data_urls: string[] | undefined,
  status: ListingStatus,
) {
  return {
    title: parsed.title,
    description: parsed.description ?? null,
    color: parsed.color ?? null,
    location: parsed.location,
    condition: parsed.condition,
    category: parsed.category,
    sell_mode: parsed.sell_mode,
    bundle_price: parsed.bundle_price ?? null,
    ...(image_urls !== undefined ? { image_urls } : {}),
    ...(image_blur_data_urls !== undefined ? { image_blur_data_urls } : {}),
    contact_email: parsed.contact_email ?? null,
    contact_phone: parsed.contact_phone ?? null,
    contact_methods: parsed.contact_methods,
    status,
  };
}

export function zodListingFormErrorMessage(e: z.ZodError): string {
  if (e.issues.some((issue) => issue.path[0] === "contact_phone")) {
    return "Leave phone blank, or enter a valid phone number.";
  }
  if (
    e.issues.some(
      (issue) => issue.path[0] === "contact_email" && issue.code !== "custom",
    )
  ) {
    return "Enter a valid email address, or clear the field.";
  }
  const custom = e.issues.find((issue) => issue.code === "custom");
  if (custom?.message) return custom.message;
  return "Please fill in all required fields.";
}

export function listingFormActionError(e: unknown): { error: string } {
  if (e instanceof z.ZodError) {
    return { error: zodListingFormErrorMessage(e) };
  }
  return { error: e instanceof Error ? e.message : "Something went wrong." };
}

/** Fields that surface an inline error directly below the control. */
export type ListingFieldName =
  | "title"
  | "location"
  | "condition"
  | "category"
  | "contact_email"
  | "contact_phone"
  | "bundle_price";

/** Per-row inline errors for a size row (size picker + price). */
export type SizeRowError = { size?: string; price?: string };

export type ListingFormErrors = {
  fields: Partial<Record<ListingFieldName, string>>;
  /** Indexed parallel to the size rows. */
  sizes: SizeRowError[];
  /** Shown next to the submit button; the catch-all for the form. */
  general: string;
};

export const EMPTY_LISTING_ERRORS: ListingFormErrors = {
  fields: {},
  sizes: [],
  general: "",
};

const CONTACT_PHONE_ERROR = "Leave phone blank, or enter a valid phone number.";

const SCALAR_FIELD_NAMES = new Set<ListingFieldName>([
  "title",
  "location",
  "condition",
  "category",
  "contact_email",
  "bundle_price",
]);

type IssueLike = { path: PropertyKey[]; message: string };

/** Route each zod issue to the control it belongs to; unmapped issues (sell_mode,
 * contact_methods) fall through to the general line. First message per slot wins. */
export function collectListingFieldErrors(
  issues: readonly IssueLike[],
): ListingFormErrors {
  const fields: ListingFormErrors["fields"] = {};
  const sizes: SizeRowError[] = [];
  let general = "";

  const setField = (name: ListingFieldName, message: string) => {
    if (!fields[name]) fields[name] = message;
  };
  const setSize = (index: number, key: keyof SizeRowError, message: string) => {
    const row = (sizes[index] ??= {});
    if (!row[key]) row[key] = message;
  };

  for (const issue of issues) {
    const [head, second, third] = issue.path;
    if (head === "sizes" && typeof second === "number") {
      setSize(second, third === "price" ? "price" : "size", issue.message);
      continue;
    }
    if (head === "contact_phone") {
      setField("contact_phone", CONTACT_PHONE_ERROR);
      continue;
    }
    if (
      typeof head === "string" &&
      SCALAR_FIELD_NAMES.has(head as ListingFieldName)
    ) {
      setField(head as ListingFieldName, issue.message);
      continue;
    }
    if (!general) general = issue.message;
  }

  return { fields, sizes, general };
}

/** Anything a control can render, ignoring the form-wide general line. */
export function hasListingFieldErrors(errors: ListingFormErrors): boolean {
  return (
    Object.keys(errors.fields).length > 0 ||
    errors.sizes.some((row) => Boolean(row?.size || row?.price))
  );
}

export function hasListingErrors(errors: ListingFormErrors): boolean {
  return hasListingFieldErrors(errors) || errors.general.length > 0;
}
