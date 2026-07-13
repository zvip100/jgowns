"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidSizePair, sizeOptionIndex } from "@/lib/gown-sizes";
import {
  GOWN_CATEGORIES,
  MAX_LISTING_IMAGES,
  SELL_MODES,
  SIZE_GROUPS,
  type GownCategoryId,
  type ServerActionErrorResult,
} from "@/lib/types";
import { imageSlotFormKeys, optionalPhoneSchema } from "@/lib/utils";
import { getAuthClient, type SupabaseServer } from "@/lib/actions/auth";
import { deleteListingImages } from "@/lib/actions/images";

const CATEGORY_IDS = GOWN_CATEGORIES.map((c) => c.id) as [
  GownCategoryId,
  ...GownCategoryId[],
];

const sizeEntrySchema = z.object({
  size: z.string().trim().min(1),
  size_group: z.enum(SIZE_GROUPS),
  // Omitted for set-only listings; required for every other mode (see superRefine).
  price: z.coerce.number().positive().optional(),
});

const listingInputSchema = z
  .object({
    title: z.string().trim().min(4),
    description: z.string().trim().optional(),
    color: z.string().trim().optional(),
    location: z.string().trim().min(1),
    condition: z.string().trim().min(1),
    category: z.enum(CATEGORY_IDS),
    sizes: z.array(sizeEntrySchema).min(1),
    sell_mode: z.enum(SELL_MODES).default("individual"),
    bundle_price: z.coerce.number().positive().optional(),
    contact_email: z.email(),
    contact_phone: optionalPhoneSchema,
    status: z.enum(["active", "sold", "removed"]).default("active"),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [i, entry] of data.sizes.entries()) {
      if (!isValidSizePair(data.category, entry.size_group, entry.size)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", i, "size"],
          message: "Size is not valid for this category.",
        });
      }
      const key = `${entry.size_group}:${entry.size}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", i, "size"],
          message: "Each size can only be added once.",
        });
      }
      seen.add(key);
    }
    if (data.sell_mode !== "individual" && data.sizes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["sell_mode"],
        message: "Set pricing requires at least two sizes.",
      });
    }
    if (data.sell_mode !== "set_only") {
      for (const [i, entry] of data.sizes.entries()) {
        if (entry.price == null) {
          ctx.addIssue({
            code: "custom",
            path: ["sizes", i, "price"],
            message: "Enter a price for every size.",
          });
        }
      }
    }
    if (data.sell_mode === "individual" && data.bundle_price != null) {
      ctx.addIssue({
        code: "custom",
        path: ["bundle_price"],
        message: "A set price is only allowed when selling sizes together.",
      });
    }
    if (data.sell_mode === "set_only" && data.bundle_price == null) {
      ctx.addIssue({
        code: "custom",
        path: ["bundle_price"],
        message: "Enter the price for the complete set.",
      });
    }
  });

type ParsedListing = z.infer<typeof listingInputSchema>;

type VariantRow = {
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
function variantRowsPayload(parsed: ParsedListing): VariantRow[] {
  const setPrice =
    parsed.sell_mode === "set_only" ? parsed.bundle_price : null;
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

type ImageSlot = {
  file: File | null;
  existingUrl: string | null;
  blur: string;
};

function strOrUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fileOrNull(value: FormDataEntryValue | null): File | null {
  if (!value) return null;
  if (typeof value === "string") return null;
  return value;
}

function zodListingFormErrorMessage(e: z.ZodError): string {
  if (e.issues.some((issue) => issue.path[0] === "contact_phone")) {
    return "Leave phone blank, or enter a valid phone number.";
  }
  const custom = e.issues.find((issue) => issue.code === "custom");
  if (custom?.message) return custom.message;
  return "Please fill in all required fields.";
}

/** `sizes` travels as a JSON string; invalid JSON is passed through so zod rejects it. */
function rawSizesFromFormData(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rawListingFieldsFromFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    description: strOrUndefined(formData.get("description")),
    color: strOrUndefined(formData.get("color")),
    location: formData.get("location"),
    condition: formData.get("condition"),
    category: formData.get("category"),
    sizes: rawSizesFromFormData(formData.get("sizes")),
    sell_mode: strOrUndefined(formData.get("sell_mode")),
    bundle_price: strOrUndefined(formData.get("bundle_price")),
    contact_email: formData.get("contact_email"),
    contact_phone: strOrUndefined(formData.get("contact_phone")),
  };
}

function listingRowPayload(
  parsed: ParsedListing,
  image_urls: string[],
  image_blur_data_urls: string[],
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
    image_urls,
    image_blur_data_urls,
    contact_email: parsed.contact_email,
    contact_phone: parsed.contact_phone ?? null,
    status: parsed.status,
  };
}

function catchSellActionError(e: unknown): { error: string } {
  if (e instanceof z.ZodError) {
    return { error: zodListingFormErrorMessage(e) };
  }
  return { error: e instanceof Error ? e.message : "Something went wrong." };
}

const MAX_BLUR_DATA_URL_LENGTH = 4096;

/** Blur strings are client-generated tiny data URLs; reject anything else. */
function sanitizeBlur(value: FormDataEntryValue | null): string {
  const blur = strOrUndefined(value);
  if (!blur) return "";
  if (!blur.startsWith("data:image/")) return "";
  if (blur.length > MAX_BLUR_DATA_URL_LENGTH) return "";
  return blur;
}

/** Collect image slots from formData, compacted (skip empty slots), at least 1 required. */
function collectImageSlots(formData: FormData): ImageSlot[] | { error: string } {
  const slots: ImageSlot[] = [];

  for (let n = 0; n < MAX_LISTING_IMAGES; n++) {
    const keys = imageSlotFormKeys(n);
    const file = fileOrNull(formData.get(keys.file));
    const existingUrl = strOrUndefined(formData.get(keys.existingUrl)) ?? null;
    const blur = sanitizeBlur(formData.get(keys.blur));

    if (file || existingUrl) {
      slots.push({ file, existingUrl, blur });
    }
  }

  if (slots.length === 0) {
    return { error: "Please add at least one gown photo." };
  }
  return slots;
}

const UPLOAD_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

async function uploadListingImage({
  supabase,
  file,
}: {
  supabase: SupabaseServer;
  file: File;
}): Promise<string> {
  const ext = UPLOAD_EXT_BY_MIME[file.type] ?? "jpg";
  const path = `${randomUUID()}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("gown-images")
    .upload(path, file);

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from("gown-images")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function createListing(
  formData: FormData,
): Promise<ServerActionErrorResult> {
  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  let shouldRedirect = false;
  const uploadedUrls: string[] = [];

  try {
    const slots = collectImageSlots(formData);
    if ("error" in slots) return { error: slots.error };

    const files: File[] = [];
    for (const slot of slots) {
      if (!slot.file) {
        return { error: "Please add at least one gown photo." };
      }
      files.push(slot.file);
    }

    const parsed = listingInputSchema.parse(
      rawListingFieldsFromFormData(formData),
    );

    const uploadResults = await Promise.allSettled(
      files.map((file) => uploadListingImage({ supabase, file })),
    );
    for (const result of uploadResults) {
      if (result.status === "fulfilled") uploadedUrls.push(result.value);
    }
    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedUpload) throw failedUpload.reason;

    const image_blur_data_urls = slots.map((s) => s.blur);

    const payload = {
      ...listingRowPayload(parsed, uploadedUrls, image_blur_data_urls),
      user_id: user.id,
    };

    const { data: created, error: dbError } = await supabase
      .from("listings")
      .insert(payload)
      .select("id")
      .single();
    if (dbError || !created) {
      await deleteListingImages(uploadedUrls);
      return { error: dbError?.message ?? "Failed to create listing." };
    }

    const variantRows = variantRowsPayload(parsed).map((row) => ({
      ...row,
      listing_id: created.id as string,
    }));
    const { error: sizesError } = await supabase
      .from("listing_sizes")
      .insert(variantRows);
    if (sizesError) {
      await supabase.from("listings").delete().eq("id", created.id);
      await deleteListingImages(uploadedUrls);
      return { error: sizesError.message };
    }

    updateTag("listings");
    shouldRedirect = true;
  } catch (e) {
    if (uploadedUrls.length > 0) await deleteListingImages(uploadedUrls);
    return catchSellActionError(e);
  }

  if (shouldRedirect) {
    redirect("/dashboard");
  }
  return {};
}

export async function updateListing(
  id: string,
  formData: FormData,
): Promise<ServerActionErrorResult> {
  if (!id || typeof id !== "string") return { error: "Invalid listing id" };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: existing, error: existingError } = await supabase
    .from("listings")
    .select("user_id, image_urls, status")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (!existing) return { error: "Listing not found" };
  if (existing.user_id !== user.id) return { error: "Not authorized" };
  if (existing.status !== "active") {
    return { error: "Only active listings can be edited." };
  }

  const oldImageUrls: string[] = existing.image_urls ?? [];

  let shouldRedirect = false;
  const newlyUploadedUrls: string[] = [];

  try {
    const slots = collectImageSlots(formData);
    if ("error" in slots) return { error: slots.error };

    for (const slot of slots) {
      if (slot.existingUrl && !oldImageUrls.includes(slot.existingUrl)) {
        return { error: "Invalid existing image URL." };
      }
    }

    const parsed = listingInputSchema.parse(
      rawListingFieldsFromFormData(formData),
    );

    const uploadResults = await Promise.allSettled(
      slots.map((slot) =>
        slot.file
          ? uploadListingImage({ supabase, file: slot.file })
          : Promise.resolve(null),
      ),
    );
    for (const result of uploadResults) {
      if (result.status === "fulfilled" && result.value) {
        newlyUploadedUrls.push(result.value);
      }
    }
    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedUpload) throw failedUpload.reason;

    const nextImageUrls: string[] = [];
    const nextBlurUrls: string[] = [];

    for (const [i, slot] of slots.entries()) {
      const uploaded = uploadResults[i];
      if (uploaded.status === "fulfilled" && uploaded.value) {
        nextImageUrls.push(uploaded.value);
      } else if (slot.existingUrl) {
        nextImageUrls.push(slot.existingUrl);
      }
      nextBlurUrls.push(slot.blur);
    }

    // An edit never changes listing status: the RPC no longer writes the status
    // column, and non-active listings are rejected above. Status transitions go
    // through their dedicated actions (markListingSold / reactivateListing).
    const payload = listingRowPayload(parsed, nextImageUrls, nextBlurUrls);

    const { error: dbError } = await supabase.rpc(
      "update_listing_with_variants",
      {
        p_listing_id: id,
        p_listing: payload,
        p_variants: variantRowsPayload(parsed),
      },
    );

    if (dbError) {
      if (newlyUploadedUrls.length > 0) {
        const cleanup = await deleteListingImages(newlyUploadedUrls);
        if ("error" in cleanup) {
          console.warn(
            "Failed to clean up replacement images after listing update error:",
            {
              listingId: id,
              replacementImageUrls: newlyUploadedUrls,
              error: cleanup.error,
            },
          );
        }
      }
      return { error: dbError.message };
    }

    // The listing row and its variants are now committed atomically; it's safe
    // to drop the images this edit orphaned and refresh caches.
    const orphans = oldImageUrls.filter((u) => !nextImageUrls.includes(u));
    if (orphans.length > 0) {
      await deleteListingImages(orphans);
    }

    updateTag(`listing:${id}`);
    updateTag("listings");

    shouldRedirect = true;
  } catch (e) {
    if (newlyUploadedUrls.length > 0) await deleteListingImages(newlyUploadedUrls);
    return catchSellActionError(e);
  }

  if (shouldRedirect) {
    redirect("/dashboard");
  }
  return {};
}
