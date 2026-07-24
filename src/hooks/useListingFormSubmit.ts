"use client";

import { useCallback, useRef, useState } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";

import { isValidSizePair } from "@/lib/gown-sizes";
import { createListing, updateListing } from "@/lib/actions/sell";
import { toast } from "@/lib/toast";
import { digitsOnlyPhone, imageSlotFormKeys } from "@/lib/utils";
import { listingInputSchema } from "@/lib/validations/listing-schema";

import {
  GOWN_CATEGORIES,
  type ContactMethod,
  type GownCategoryId,
  type ListingFormData,
  type ListingSizeInput,
  type ListingSizeRowState,
  type SellMode,
  type ImageSlotState,
} from "@/lib/types";

/** Scalar form fields — size rows, set pricing, and contact methods live in their own state. */
type ListingScalarFormData = Partial<
  Omit<ListingFormData, "sizes" | "contact_methods">
>;

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

const FIX_HIGHLIGHTED_FIELDS = "Please fix the highlighted fields.";
const CONTACT_PHONE_ERROR = "Leave phone blank, or enter a valid phone number.";
const EITHER_NOT_DISCOUNTED_ERROR =
  "The price for all sizes together should be less than the sizes priced individually.";
const MISSING_PHOTO_ERROR = "Please add at least one gown photo.";

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

function hasFieldOrSizeErrors(errors: ListingFormErrors): boolean {
  return (
    Object.keys(errors.fields).length > 0 ||
    errors.sizes.some((row) => Boolean(row?.size || row?.price))
  );
}

export function hasListingErrors(errors: ListingFormErrors): boolean {
  return hasFieldOrSizeErrors(errors) || errors.general.length > 0;
}

type ListingValidationInput = {
  form: ListingScalarFormData;
  sizeRows: ListingSizeRowState[];
  sellMode: SellMode;
  bundle: number | null;
  contactMethods: ContactMethod[];
  hasActivePhoto: boolean;
};

/** Validate the whole form against the shared schema, then layer the two
 * client-only rules (photo required, "either" set price must be a discount). */
export function validateListingForm({
  form,
  sizeRows,
  sellMode,
  bundle,
  contactMethods,
  hasActivePhoto,
}: ListingValidationInput): ListingFormErrors {
  const parseInput = {
    title: form.title ?? "",
    description: form.description?.trim() || undefined,
    color: form.color?.trim() || undefined,
    location: form.location ?? "",
    condition: form.condition ?? "",
    category: form.category ?? undefined,
    sizes: sizeRows.map((row) => ({
      size: row.size,
      size_group: row.size_group ?? undefined,
      ...(sellMode === "set_only"
        ? {}
        : { price: row.price.trim() === "" ? undefined : row.price }),
    })),
    sell_mode: sellMode,
    bundle_price:
      sellMode === "individual" || bundle == null ? undefined : String(bundle),
    contact_email: form.contact_email?.trim() || undefined,
    contact_phone: form.contact_phone?.trim() || undefined,
    contact_methods: contactMethods,
    status: form.status ?? "active",
  };

  const result = listingInputSchema.safeParse(parseInput);
  const errors: ListingFormErrors = result.success
    ? { fields: {}, sizes: [], general: "" }
    : collectListingFieldErrors(result.error.issues);

  // Client-only: an "either" set price must undercut the per-size total. Only
  // meaningful once every field parsed, so guard on a clean schema result.
  if (result.success && sellMode === "either" && bundle != null) {
    const individualTotal = sizeRows.reduce(
      (sum, row) => sum + (Number(row.price) || 0),
      0,
    );
    if (individualTotal > 0 && bundle >= individualTotal) {
      errors.fields.bundle_price = EITHER_NOT_DISCOUNTED_ERROR;
    }
  }

  if (hasFieldOrSizeErrors(errors)) {
    errors.general = FIX_HIGHLIGHTED_FIELDS;
  } else if (!hasActivePhoto) {
    errors.general = MISSING_PHOTO_ERROR;
  }

  return errors;
}

export type ListingSizesController = {
  rows: ListingSizeRowState[];
  updateRow: (
    key: string,
    patch: Partial<Omit<ListingSizeRowState, "key">>,
  ) => void;
  addRow: () => void;
  removeRow: (key: string) => void;
  sellOnlyAsSet: boolean;
  setSellOnlyAsSet: (value: boolean) => void;
  bundlePrice: string;
  setBundlePrice: (value: string) => void;
};

/** The seller only sees rows + a checkbox + an optional set price; the enum is computed. */
export function deriveSellMode(
  rowCount: number,
  sellOnlyAsSet: boolean,
  bundlePrice: string,
): SellMode {
  if (rowCount < 2) return "individual";
  if (sellOnlyAsSet) return "set_only";
  return bundlePrice.trim() ? "either" : "individual";
}

function buildInitialForm(
  initial?: Partial<ListingFormData>,
): ListingScalarFormData {
  const {
    sizes: _sizes,
    contact_methods: _contactMethods,
    ...rest
  } = initial ?? {};
  const base: ListingScalarFormData = {
    title: "",
    description: "",
    color: "",
    location: "",
    condition: undefined,
    contact_email: "",
    contact_phone: "",
    status: "active",
    ...rest,
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

function buildInitialRows(
  initial?: Partial<ListingFormData>,
): ListingSizeRowState[] {
  const sizes = initial?.sizes ?? [];
  if (sizes.length === 0) {
    return [{ key: "row-0", size: "", size_group: null, price: "" }];
  }
  // Set-only variants store the shared set price, not a per-size price, so the
  // (hidden) price inputs start blank — unchecking "set only" forces re-entry.
  const isSetOnly = initial?.sell_mode === "set_only";
  return sizes.map((entry: ListingSizeInput, i) => ({
    key: `row-${i}`,
    size: entry.size,
    size_group: entry.size_group,
    price: isSetOnly ? "" : String(entry.price ?? ""),
  }));
}

/** Stable serialization of the size/pricing state for no-op edit detection. */
function sizeStateSnapshot(
  rows: ListingSizeRowState[],
  sellOnlyAsSet: boolean,
  bundlePrice: string,
): string {
  return JSON.stringify({
    rows: rows.map((r) => [r.size_group, r.size, r.price]),
    sellOnlyAsSet,
    bundlePrice: bundlePrice.trim(),
  });
}

/** Order-insensitive equality for the small contact-methods set. */
function sameMethods(a: ContactMethod[], b: ContactMethod[]): boolean {
  return a.length === b.length && a.every((m) => b.includes(m));
}

/** True if any form field differs from the values the form loaded with. */
function listingFormChanged(
  current: ListingScalarFormData,
  baseline: ListingScalarFormData,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    const k = key as keyof ListingScalarFormData;
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
  const [errors, setErrors] = useState<ListingFormErrors>(EMPTY_LISTING_ERRORS);
  const [form, setForm] = useState<ListingScalarFormData>(() =>
    buildInitialForm(initial),
  );
  const [sizeRows, setSizeRows] = useState<ListingSizeRowState[]>(() =>
    buildInitialRows(initial),
  );
  const [sellOnlyAsSet, setSellOnlyAsSetState] = useState(
    initial?.sell_mode === "set_only",
  );
  const [bundlePrice, setBundlePrice] = useState(
    initial?.bundle_price != null ? String(initial.bundle_price) : "",
  );
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>(
    initial?.contact_methods ?? [],
  );

  const initialFormRef = useRef(form);
  const initialSizeSnapshotRef = useRef(
    sizeStateSnapshot(sizeRows, sellOnlyAsSet, bundlePrice),
  );
  const originalImageUrlsRef = useRef(initial?.image_urls ?? []);
  const initialContactMethodsRef = useRef(contactMethods);

  const setField = useCallback(
    (key: keyof ListingScalarFormData, value: string | number) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const setCategory = useCallback((value: string) => {
    const category = GOWN_CATEGORIES.some((c) => c.id === value)
      ? (value as GownCategoryId)
      : null;
    setForm((f) => ({ ...f, category }));
    setSizeRows((rows) =>
      rows.map((row) => {
        const keepSize =
          category &&
          row.size &&
          row.size_group &&
          isValidSizePair(category, row.size_group, row.size);
        return keepSize ? row : { ...row, size: "", size_group: null };
      }),
    );
  }, []);

  const setContactPhone = useCallback((value: string) => {
    const digits = digitsOnlyPhone(value);
    setForm((f) => ({ ...f, contact_phone: digits }));
    // A contact method only makes sense with a phone number to act on.
    if (!digits) setContactMethods([]);
  }, []);

  const toggleContactMethod = useCallback(
    (method: ContactMethod, checked: boolean) => {
      setContactMethods((prev) =>
        checked
          ? prev.includes(method)
            ? prev
            : [...prev, method]
          : prev.filter((m) => m !== method),
      );
    },
    [],
  );

  const updateRow = useCallback(
    (key: string, patch: Partial<Omit<ListingSizeRowState, "key">>) => {
      setSizeRows((rows) =>
        rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const addRow = useCallback(() => {
    setSizeRows((rows) => [
      ...rows,
      { key: crypto.randomUUID(), size: "", size_group: null, price: "" },
    ]);
  }, []);

  const removeRow = useCallback(
    (key: string) => {
      if (sizeRows.length <= 1) return;
      const next = sizeRows.filter((row) => row.key !== key);
      setSizeRows(next);
      if (next.length === 1) {
        setSellOnlyAsSetState(false);
        setBundlePrice("");
      }
    },
    [sizeRows],
  );

  const setSellOnlyAsSet = useCallback((value: boolean) => {
    setSellOnlyAsSetState(value);
  }, []);

  const sizesController: ListingSizesController = {
    rows: sizeRows,
    updateRow,
    addRow,
    removeRow,
    sellOnlyAsSet,
    setSellOnlyAsSet,
    bundlePrice,
    setBundlePrice,
  };

  const handleSubmit = useCallback(async () => {
    setErrors(EMPTY_LISTING_ERRORS);

    // Editing with no changes: skip the server round-trip and just return to the dashboard.
    if (
      listingId &&
      !listingFormChanged(form, initialFormRef.current) &&
      sizeStateSnapshot(sizeRows, sellOnlyAsSet, bundlePrice) ===
        initialSizeSnapshotRef.current &&
      sameMethods(contactMethods, initialContactMethodsRef.current) &&
      !listingImagesChanged(slots, originalImageUrlsRef.current)
    ) {
      router.push("/dashboard");
      return;
    }

    const sellMode = deriveSellMode(
      sizeRows.length,
      sellOnlyAsSet,
      bundlePrice,
    );
    const bundle = bundlePrice.trim() ? Number(bundlePrice) : null;
    const hasActivePhoto = slots.some((s) => s.imageFile || s.existingUrl);

    const validationErrors = validateListingForm({
      form,
      sizeRows,
      sellMode,
      bundle,
      contactMethods,
      hasActivePhoto,
    });
    if (hasListingErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      // Set-only variants carry no per-size price — the server stamps each one
      // with the shared set price. Every other mode sends its per-size price.
      const sizes = sizeRows.map((row) =>
        sellMode === "set_only"
          ? { size: row.size, size_group: row.size_group }
          : {
              size: row.size,
              size_group: row.size_group,
              price: Number(row.price),
            },
      );

      const activeSlots = slots.filter((s) => s.imageFile || s.existingUrl);

      const formData = new FormData();

      formData.set("title", (form.title ?? "").trim());
      formData.set("description", form.description?.trim() || "");
      formData.set("color", form.color?.trim() || "");
      formData.set("location", String(form.location));
      formData.set("condition", String(form.condition));
      formData.set("category", String(form.category));
      formData.set("sizes", JSON.stringify(sizes));
      formData.set("sell_mode", sellMode);
      formData.set(
        "bundle_price",
        sellMode === "individual" || bundle == null ? "" : String(bundle),
      );
      formData.set("contact_email", form.contact_email?.trim() || "");
      formData.set("contact_phone", form.contact_phone?.trim() || "");
      formData.set("contact_methods", JSON.stringify(contactMethods));
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

      // Server-action outcome errors surface as a toast; field validation
      // (above) stays inline via setErrors.
      if (result?.error) {
        toast.error(
          listingId ? "Couldn't save changes" : "Couldn't publish listing",
          { description: result.error },
        );
        return;
      }
    } catch (e: unknown) {
      unstable_rethrow(e);
      setErrors({ fields: {}, sizes: [], general: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }, [
    form,
    listingId,
    sizeRows,
    sellOnlyAsSet,
    bundlePrice,
    contactMethods,
    slots,
    resolveUploadFile,
    router,
  ]);

  return {
    form,
    setField,
    setCategory,
    setContactPhone,
    contactMethods,
    toggleContactMethod,
    sizesController,
    loading,
    errors,
    handleSubmit,
    isEdit: Boolean(listingId),
  };
}
