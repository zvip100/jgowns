"use client";

import { useState } from "react";
import { Save } from "lucide-react";

import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  LOCATIONS,
} from "@/lib/types";
import { FormInfoBanner } from "@/components/form/FormInfoBanner";
import { FormSection } from "@/components/form/FormSection";
import { SelectField, toSelectOptions } from "@/components/form/SelectField";
import { TextInputField } from "@/components/form/TextInputField";
import { TextareaField } from "@/components/form/TextareaField";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";
import { toast } from "@/lib/toast";

import { adminActionPending } from "../../../../admin-pending";

import type { SubmitEvent } from "react";
import type { AdminListing } from "@/lib/admin/types";

/** Only the scalar fields this form edits, so the row is not shipped whole. */
export type AdminListingEditFields = Pick<
  AdminListing,
  | "id"
  | "title"
  | "description"
  | "location"
  | "condition"
  | "category"
  | "color"
  | "contact_email"
  | "contact_phone"
>;

type AdminListingEditFormProps = {
  listing: AdminListingEditFields;
};

const LOCATION_OPTIONS = toSelectOptions(LOCATIONS);
const CONDITION_OPTIONS = toSelectOptions([...GOWN_CONDITIONS]);
const CATEGORY_OPTIONS = GOWN_CATEGORIES.map((c) => ({
  value: c.id,
  label: c.label,
}));
const COLOR_OPTIONS = toSelectOptions(GOWN_COLORS);

/**
 * Phase 1 edit shell: same core fields as the seller form, inert submit.
 * Does not reuse ListingForm (photo upload would hit real storage).
 * Phase 3 replaces this with ListingForm (or an admin submit path) wired to
 * admin listing actions.
 */
export function AdminListingEditForm({ listing }: AdminListingEditFormProps) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [location, setLocation] = useState(listing.location ?? "");
  const [condition, setCondition] = useState(listing.condition);
  const [category, setCategory] = useState(listing.category ?? "");
  const [color, setColor] = useState(listing.color ?? "");
  const [email, setEmail] = useState(listing.contact_email ?? "");
  const [phone, setPhone] = useState(listing.contact_phone ?? "");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    const result = await adminActionPending();
    setIsPending(false);
    toast.error("Changes not saved", { description: result.error });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormInfoBanner icon={Save}>
        Admin edit. Saves are inert until Phase 3. Photo and size editing will
        reuse the seller form path then.
      </FormInfoBanner>

      <FormSection legend="Listing">
        <TextInputField
          id="admin-title"
          label="Title"
          value={title}
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
          onChange={setLocation}
          options={LOCATION_OPTIONS}
        />
        <SelectField
          id="admin-condition"
          label="Condition"
          placeholder="Select condition"
          value={condition}
          onChange={(v) =>
            setCondition(v as (typeof GOWN_CONDITIONS)[number])
          }
          options={CONDITION_OPTIONS}
        />
        <SelectField
          id="admin-category"
          label="Category"
          placeholder="Select category"
          value={category}
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

      <FormSection legend="Contact">
        <TextInputField
          id="admin-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInputField
          id="admin-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormSection>

      <Button
        type="submit"
        disabled={isPending}
        className={`${PRIMARY_CTA_CLASS} sm:w-auto sm:self-start`}
      >
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
