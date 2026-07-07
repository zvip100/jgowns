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
  type ListingSizeInput,
  type ListingSizeRowState,
  type SellMode,
  type SizeGroupSlug,
  type ImageSlotState,
} from "@/lib/types";

/** Scalar form fields — size rows and set pricing live in their own state. */
type ListingScalarFormData = Partial<Omit<ListingFormData, "sizes">>;

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
  const { sizes: _sizes, ...rest } = initial ?? {};
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
  const [error, setError] = useState("");
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

  const initialFormRef = useRef(form);
  const initialSizeSnapshotRef = useRef(
    sizeStateSnapshot(sizeRows, sellOnlyAsSet, bundlePrice),
  );
  const originalImageUrlsRef = useRef(initial?.image_urls ?? []);

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
    setForm((f) => ({ ...f, contact_phone: digitsOnlyPhone(value) }));
  }, []);

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
    setError("");

    // Editing with no changes: skip the server round-trip and just return to the dashboard.
    if (
      listingId &&
      !listingFormChanged(form, initialFormRef.current) &&
      sizeStateSnapshot(sizeRows, sellOnlyAsSet, bundlePrice) ===
        initialSizeSnapshotRef.current &&
      !listingImagesChanged(slots, originalImageUrlsRef.current)
    ) {
      router.push("/dashboard");
      return;
    }

    setLoading(true);

    try {
      if (
        !form.title?.trim() ||
        !form.location ||
        !form.condition ||
        !form.contact_email?.trim() ||
        !form.category ||
        !GOWN_CATEGORIES.some((c) => c.id === form.category)
      ) {
        throw new Error("Please fill in all required fields.");
      }

      const seenSizes = new Set<string>();
      for (const row of sizeRows) {
        if (!row.size || !row.size_group) {
          throw new Error("Choose a size for every row.");
        }
        const sizeKey = `${row.size_group}:${row.size}`;
        if (seenSizes.has(sizeKey)) {
          throw new Error("Each size can only be added once.");
        }
        seenSizes.add(sizeKey);
      }

      const sellMode = deriveSellMode(
        sizeRows.length,
        sellOnlyAsSet,
        bundlePrice,
      );
      const bundle = bundlePrice.trim() ? Number(bundlePrice) : null;

      if (sellMode === "set_only") {
        if (bundle == null || Number.isNaN(bundle) || bundle <= 0) {
          throw new Error("Enter the price for the complete set.");
        }
      }

      // Set-only variants carry no per-size price — the server stamps each one
      // with the shared set price. Every other mode needs a price per size.
      const sizes: {
        size: string;
        size_group: SizeGroupSlug | null;
        price?: number;
      }[] = sizeRows.map((row) => {
        if (sellMode === "set_only") {
          return { size: row.size, size_group: row.size_group };
        }
        const price = Number(row.price);
        if (!row.price.trim() || Number.isNaN(price) || price <= 0) {
          throw new Error("Enter a price for every size.");
        }
        return { size: row.size, size_group: row.size_group, price };
      });

      if (sellMode === "either") {
        if (bundle == null || Number.isNaN(bundle) || bundle <= 0) {
          throw new Error("Enter a valid price for all sizes together.");
        }
        const individualTotal = sizes.reduce((sum, s) => sum + (s.price ?? 0), 0);
        if (bundle >= individualTotal) {
          throw new Error(
            "The price for all sizes together should be less than the sizes priced individually.",
          );
        }
      }

      const activeSlots = slots.filter((s) => s.imageFile || s.existingUrl);
      if (activeSlots.length === 0) {
        throw new Error("Please add at least one gown photo.");
      }

      const formData = new FormData();

      formData.set("title", form.title.trim());
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
  }, [
    form,
    listingId,
    sizeRows,
    sellOnlyAsSet,
    bundlePrice,
    slots,
    resolveUploadFile,
    router,
  ]);

  return {
    form,
    setField,
    setCategory,
    setContactPhone,
    sizesController,
    loading,
    error,
    handleSubmit,
    isEdit: Boolean(listingId),
  };
}
