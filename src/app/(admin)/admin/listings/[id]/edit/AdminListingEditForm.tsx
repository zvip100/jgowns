"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { ImageOff } from "lucide-react";

import { useSizeRows } from "@/hooks/useSizeRows";
import { adminUpdateListing } from "@/lib/actions/admin/listings";
import { isValidSizePair } from "@/lib/gown-sizes";
import {
  EMPTY_LISTING_ERRORS,
  collectListingFieldErrors,
  rawListingFieldsFromFormData,
  toggleContactMethod as toggleContactMethodValue,
} from "@/lib/listing-form";
import { listingInputSchema } from "@/lib/validations/listing-schema";
import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  LOCATIONS,
  SELL_MODES,
} from "@/lib/types";
import { ContactMethodsField } from "@/components/form/ContactMethodsField";
import { FormInfoBanner } from "@/components/form/FormInfoBanner";
import { FormSection } from "@/components/form/FormSection";
import { InputGroupField } from "@/components/form/InputGroupField";
import { SelectField, toSelectOptions } from "@/components/form/SelectField";
import { TextInputField } from "@/components/form/TextInputField";
import { TextareaField } from "@/components/form/TextareaField";
import { SizeRowsList } from "@/components/SizeRowsList";
import { Button } from "@/components/ui/button";
import { ADMIN_DEMO_MODE_MESSAGE } from "@/lib/admin/constants";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";
import { toast } from "@/lib/toast";
import { digitsOnlyPhone } from "@/lib/utils";

import { ADMIN_SELL_MODE_LABELS } from "../../../../admin-audit-labels";

import type { SubmitEvent } from "react";
import type { ListingFormErrors } from "@/lib/listing-form";
import type { AdminListing } from "@/lib/admin/types";
import type {
  ContactMethod,
  GownCategoryId,
  ListingSizeInput,
  ListingSizeRowState,
  SellMode,
} from "@/lib/types";

/** The fields this form edits. Photos are moderated on the detail page. */
export type AdminListingEditFields = Pick<
  AdminListing,
  | "id"
  | "title"
  | "description"
  | "location"
  | "condition"
  | "category"
  | "color"
  | "sell_mode"
  | "bundle_price"
  | "contact_email"
  | "contact_phone"
  | "contact_methods"
> & { sizes: ListingSizeInput[] };

type AdminListingEditFormProps = {
  listing: AdminListingEditFields;
  /** Demo mode renders a fixture id, so the form must not offer to save it. */
  isDemo?: boolean;
};

const LOCATION_OPTIONS = toSelectOptions(LOCATIONS);
const CONDITION_OPTIONS = toSelectOptions([...GOWN_CONDITIONS]);
const CATEGORY_OPTIONS = GOWN_CATEGORIES.map((c) => ({
  value: c.id,
  label: c.label,
}));
const COLOR_OPTIONS = toSelectOptions(GOWN_COLORS);
const SELL_MODE_OPTIONS = SELL_MODES.map((mode) => ({
  value: mode,
  label: ADMIN_SELL_MODE_LABELS[mode],
}));

/** The set price is banned, required, or optional depending on the mode. */
const SET_PRICE_HINTS: Record<SellMode, string> = {
  individual: "Leave blank when sizes are sold individually.",
  set_only: "Required. This listing sells only as a complete set.",
  either: "Optional: one price for the full set.",
};

function toSellMode(value: string): SellMode {
  return SELL_MODES.find((mode) => mode === value) ?? "individual";
}

/**
 * Set-only variants store the shared set price, not a per-size price (MEMORY
 * 07-03), so the price inputs start blank when the listing loaded as set_only
 * — otherwise switching to individual/either would silently offer the former
 * bundle total as every gown's price.
 */
function buildSizeRows(
  sizes: ListingSizeInput[],
  isSetOnly: boolean,
): ListingSizeRowState[] {
  if (sizes.length === 0) {
    return [{ key: "row-0", size: "", size_group: null, price: "" }];
  }
  return sizes.map((entry, i) => ({
    key: `row-${i}`,
    size: entry.size,
    size_group: entry.size_group,
    price: isSetOnly || entry.price == null ? "" : String(entry.price),
  }));
}

/**
 * Admin edit, allowed in any status. Deliberately not `ListingForm`: that form
 * owns the photo uploader, and admin image moderation is remove-only, so the
 * stored photos are left alone and re-read server-side. Sizes reuse the
 * seller's `useSizeRows`/`SizeRowsList`, but sell mode stays an explicit select
 * rather than the seller's derived checkbox: an operator sets the mode
 * directly.
 */
export function AdminListingEditForm({
  listing,
  isDemo = false,
}: AdminListingEditFormProps) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [location, setLocation] = useState(listing.location ?? "");
  const [condition, setCondition] = useState<string>(listing.condition);
  const [category, setCategoryState] = useState<GownCategoryId | null>(
    () => GOWN_CATEGORIES.find((c) => c.id === listing.category)?.id ?? null,
  );
  const [color, setColor] = useState(listing.color ?? "");
  const [sellMode, setSellMode] = useState<SellMode>(listing.sell_mode);
  const [bundlePrice, setBundlePrice] = useState(
    listing.bundle_price == null ? "" : String(listing.bundle_price),
  );
  const { rows: sizeRows, updateRow, addRow, removeRow, clearInvalidRows } =
    useSizeRows(() =>
      buildSizeRows(listing.sizes, listing.sell_mode === "set_only"),
    );
  const [email, setEmail] = useState(listing.contact_email ?? "");
  const [phone, setPhone] = useState(listing.contact_phone ?? "");
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>(
    listing.contact_methods,
  );
  const [isPending, setIsPending] = useState(false);
  // Same shape the seller form uses: field messages render on their control;
  // submit outcomes toast instead (AGENTS §7).
  const [errors, setErrors] = useState<ListingFormErrors>(EMPTY_LISTING_ERRORS);

  const isSetOnly = sellMode === "set_only";
  // listings_contact_methods_need_phone_check: call or text needs a number to
  // act on, which the shared zod schema enforces on the way in as well.
  const hasPhone = phone.trim().length > 0;

  const setCategory = (value: string) => {
    const next = GOWN_CATEGORIES.find((c) => c.id === value)?.id ?? null;
    setCategoryState(next);
    clearInvalidRows(
      (row) =>
        next != null &&
        row.size_group != null &&
        isValidSizePair(next, row.size_group, row.size),
    );
  };

  const setContactPhone = (value: string) => {
    const digits = digitsOnlyPhone(value);
    setPhone(digits);
    if (!digits) setContactMethods([]);
  };

  const toggleContactMethod = (method: ContactMethod, checked: boolean) => {
    setContactMethods((prev) => toggleContactMethodValue(prev, method, checked));
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors(EMPTY_LISTING_ERRORS);

    // Set-only variants carry no per-size price; the server stamps each one
    // with the shared set price.
    const sizes = sizeRows.map((row) =>
      isSetOnly
        ? { size: row.size, size_group: row.size_group }
        : {
            size: row.size,
            size_group: row.size_group,
            price: Number(row.price),
          },
    );

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("color", color);
    formData.set("location", location);
    formData.set("condition", condition);
    formData.set("category", category ?? "");
    formData.set("sell_mode", sellMode);
    formData.set("bundle_price", bundlePrice);
    formData.set("sizes", JSON.stringify(sizes));
    formData.set("contact_email", email);
    formData.set("contact_phone", phone);
    formData.set("contact_methods", JSON.stringify(contactMethods));

    // Validated through the action's own parsing path, so the inline messages
    // and the server's authority can never drift apart.
    const parsed = listingInputSchema.safeParse(
      rawListingFieldsFromFormData(formData),
    );
    if (!parsed.success) {
      setErrors(collectListingFieldErrors(parsed.error.issues));
      return;
    }

    setIsPending(true);

    try {
      const result = await adminUpdateListing(listing.id, formData);
      if (result?.error) {
        toast.error("Couldn't save changes", { description: result.error });
        return;
      }
      toast.success("Listing updated");
    } catch (e: unknown) {
      unstable_rethrow(e);
      console.error("Admin listing edit failed:", e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormInfoBanner icon={ImageOff}>
        Photos are moderated from the listing page, one at a time. Editing here
        leaves them untouched.
      </FormInfoBanner>

      <FormSection legend="Listing">
        <TextInputField
          id="admin-title"
          label="Title"
          value={title}
          error={errors.fields.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextareaField
          id="admin-description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField
          id="admin-location"
          label="Location"
          placeholder="Select location"
          value={location}
          error={errors.fields.location}
          onChange={setLocation}
          options={LOCATION_OPTIONS}
        />
        <SelectField
          id="admin-condition"
          label="Condition"
          placeholder="Select condition"
          value={condition}
          error={errors.fields.condition}
          onChange={setCondition}
          options={CONDITION_OPTIONS}
        />
        <SelectField
          id="admin-category"
          label="Category"
          placeholder="Select category"
          value={category ?? ""}
          error={errors.fields.category}
          onChange={setCategory}
          options={CATEGORY_OPTIONS}
        />
        <SelectField
          id="admin-color"
          label="Color"
          placeholder="Select color"
          value={color}
          onChange={setColor}
          options={COLOR_OPTIONS}
        />
      </FormSection>

      <FormSection legend="Pricing and sizes">
        <SelectField
          id="admin-sell-mode"
          label="Sell mode"
          placeholder="Select sell mode"
          value={sellMode}
          onChange={(v) => setSellMode(toSellMode(v))}
          options={SELL_MODE_OPTIONS}
        />
        <SizeRowsList
          rows={sizeRows}
          category={category}
          showPrice={!isSetOnly}
          sizeErrors={errors.sizes}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />

        <InputGroupField
          id="admin-bundle-price"
          label="Set price"
          description={SET_PRICE_HINTS[sellMode]}
          leading="$"
          type="number"
          inputMode="decimal"
          placeholder="1150"
          value={bundlePrice}
          error={errors.fields.bundle_price}
          onChange={(e) => setBundlePrice(e.target.value)}
        />
      </FormSection>

      <FormSection legend="Contact">
        <TextInputField
          id="admin-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.fields.contact_email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInputField
          id="admin-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          error={errors.fields.contact_phone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
        <ContactMethodsField
          value={contactMethods}
          onToggle={toggleContactMethod}
          disabled={!hasPhone}
        />
      </FormSection>

      {errors.general && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.general}
        </p>
      )}

      <Button
        type="submit"
        disabled={isDemo || isPending}
        title={isDemo ? ADMIN_DEMO_MODE_MESSAGE : undefined}
        className={`${PRIMARY_CTA_CLASS} sm:w-auto sm:self-start`}
      >
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
