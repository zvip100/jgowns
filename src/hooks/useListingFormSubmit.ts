"use client";

import { useCallback, useRef, useState } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";

import { isValidSizePair } from "@/lib/gown-sizes";
import { createListing, updateListing } from "@/lib/actions/sell";
import { digitsOnlyPhone, imageSlotFormKeys } from "@/lib/utils";

import {
  GOWN_CATEGORIES,
  type GownCategoryId,
  type ListingFormData,
  type SizeGroupSlug,
  type ImageSlotState,
} from "@/lib/types";

function buildInitialForm(
  initial?: Partial<ListingFormData>,
): Partial<ListingFormData> {
  const base: Partial<ListingFormData> = {
    title: "",
    description: "",
    size: "",
    color: "",
    location: "",
    condition: undefined,
    price: undefined,
    contact_email: "",
    contact_phone: "",
    status: "active",
    ...initial,
  };
  const raw = base.category;
  const category =
    raw && GOWN_CATEGORIES.some((c) => c.id === raw) ? raw : null;

  return {
    ...base,
    category,
    contact_phone: digitsOnlyPhone(base.contact_phone),
  };
}

/** True if any form field differs from the values the form loaded with. */
function listingFormChanged(
  current: Partial<ListingFormData>,
  baseline: Partial<ListingFormData>,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    const k = key as keyof ListingFormData;
    if ((current[k] ?? "") !== (baseline[k] ?? "")) return true;
  }
  return false;
}

/** True if photos were added, replaced, removed, or reordered since load. */
function listingImagesChanged(
  slots: ImageSlotState[],
  originalUrls: string[],
): boolean {
  if (slots.some((slot) => slot.imageFile)) return true;
  const currentUrls = slots
    .filter((slot) => slot.existingUrl)
    .map((slot) => slot.existingUrl);
  if (currentUrls.length !== originalUrls.length) return true;
  return currentUrls.some((url, i) => url !== originalUrls[i]);
}

type UseListingFormSubmitOptions = {
  initial?: Partial<ListingFormData>;
  listingId?: string;
  slots: ImageSlotState[];
  resolveUploadFile: (slot: ImageSlotState) => Promise<File | null>;
};

export function useListingFormSubmit({
  initial,
  listingId,
  slots,
  resolveUploadFile,
}: UseListingFormSubmitOptions) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<ListingFormData>>(() =>
    buildInitialForm(initial),
  );

  const initialFormRef = useRef(form);
  const originalImageUrlsRef = useRef(initial?.image_urls ?? []);

  const setField = useCallback(
    (key: keyof ListingFormData, value: string | number) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const setSizeSelection = useCallback(
    (selection: { size: string; sizeGroup: SizeGroupSlug }) => {
      setForm((f) => ({
        ...f,
        size: selection.size,
        size_group: selection.sizeGroup,
      }));
    },
    [],
  );

  const setCategory = useCallback((value: string) => {
    const category = GOWN_CATEGORIES.some((c) => c.id === value)
      ? (value as GownCategoryId)
      : null;
    setForm((f) => {
      const keepSize =
        category &&
        f.size &&
        f.size_group &&
        isValidSizePair(category, f.size_group, f.size);
      return {
        ...f,
        category,
        size: keepSize ? f.size : "",
        size_group: keepSize ? f.size_group : undefined,
      };
    });
  }, []);

  const setContactPhone = useCallback((value: string) => {
    setForm((f) => ({ ...f, contact_phone: digitsOnlyPhone(value) }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");

    // Editing with no changes: skip the server round-trip and just return to the dashboard.
    if (
      listingId &&
      !listingFormChanged(form, initialFormRef.current) &&
      !listingImagesChanged(slots, originalImageUrlsRef.current)
    ) {
      router.push("/dashboard");
      return;
    }

    setLoading(true);

    try {
      if (
        !form.title?.trim() ||
        !form.size ||
        !form.size_group ||
        !form.location ||
        !form.condition ||
        form.price == null ||
        Number.isNaN(form.price) ||
        !form.contact_email?.trim() ||
        !form.category ||
        !GOWN_CATEGORIES.some((c) => c.id === form.category)
      ) {
        throw new Error("Please fill in all required fields.");
      }

      const activeSlots = slots.filter((s) => s.imageFile || s.existingUrl);
      if (activeSlots.length === 0) {
        throw new Error("Please add at least one gown photo.");
      }

      const formData = new FormData();

      formData.set("title", form.title.trim());
      formData.set("description", form.description?.trim() || "");
      formData.set("size", String(form.size));
      formData.set("size_group", String(form.size_group));
      formData.set("color", form.color?.trim() || "");
      formData.set("location", String(form.location));
      formData.set("condition", String(form.condition));
      formData.set("category", String(form.category));
      formData.set("price", String(form.price));
      formData.set("contact_email", form.contact_email.trim());
      formData.set("contact_phone", form.contact_phone?.trim() || "");
      formData.set("status", String(form.status ?? "active"));

      const slotPayloads = await Promise.all(
        activeSlots.map(async (slot) => {
          const [blur, uploadFile] = await Promise.all([
            slot.blurPromise,
            slot.imageFile ? resolveUploadFile(slot) : null,
          ]);
          return { slot, blur: blur ?? "", uploadFile };
        }),
      );

      for (const [i, { slot, blur, uploadFile }] of slotPayloads.entries()) {
        const keys = imageSlotFormKeys(i);
        formData.set(keys.blur, blur);
        if (uploadFile) {
          formData.set(keys.file, uploadFile);
        } else if (slot.existingUrl) {
          formData.set(keys.existingUrl, slot.existingUrl);
        }
      }

      const result = listingId
        ? await updateListing(listingId, formData)
        : await createListing(formData);

      if (result?.error) throw new Error(result.error);
    } catch (e: unknown) {
      unstable_rethrow(e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [form, listingId, slots, resolveUploadFile, router]);

  return {
    form,
    setField,
    setSizeSelection,
    setCategory,
    setContactPhone,
    loading,
    error,
    handleSubmit,
    isEdit: Boolean(listingId),
  };
}
