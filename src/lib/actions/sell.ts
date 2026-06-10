"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidSizePair } from "@/lib/gown-sizes";
import {
  GOWN_CATEGORIES,
  MAX_LISTING_IMAGES,
  SIZE_GROUPS,
  type GownCategoryId,
  type ServerActionErrorResult,
} from "@/lib/types";
import { imageSlotFormKeys } from "@/lib/utils";
import { getAuthClient, type SupabaseServer } from "@/lib/actions/auth";
import { deleteListingImages } from "@/lib/actions/images";

const CATEGORY_IDS = GOWN_CATEGORIES.map((c) => c.id) as [
  GownCategoryId,
  ...GownCategoryId[],
];

/** Optional phone: empty → undefined; otherwise digits only, 7–15 (E.164-style cap). */
const contactPhoneField = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val !== "string") return val;

    const digits = val.replace(/\D/g, "");
    return digits.length === 0 ? undefined : digits;
  },
  z.union([z.undefined(), z.string().min(7).max(15)]),
);

const listingInputSchema = z
  .object({
    title: z.string().trim().min(4),
    description: z.string().trim().optional(),
    size: z.string().trim().min(1),
    size_group: z.enum(SIZE_GROUPS),
    color: z.string().trim().optional(),
    location: z.string().trim().min(1),
    condition: z.string().trim().min(1),
    category: z.enum(CATEGORY_IDS),
    price: z.coerce.number(),
    contact_email: z.email(),
    contact_phone: contactPhoneField,
    status: z.enum(["active", "sold", "removed"]).default("active"),
  })
  .refine((data) => isValidSizePair(data.category, data.size_group, data.size), {
    message: "Size is not valid for this category.",
    path: ["size"],
  });

type ParsedListing = z.infer<typeof listingInputSchema>;

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
  return "Please fill in all required fields.";
}

function rawListingFieldsFromFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    description: strOrUndefined(formData.get("description")),
    size: formData.get("size"),
    size_group: formData.get("size_group"),
    color: strOrUndefined(formData.get("color")),
    location: formData.get("location"),
    condition: formData.get("condition"),
    category: formData.get("category"),
    price: formData.get("price"),
    contact_email: formData.get("contact_email"),
    contact_phone: strOrUndefined(formData.get("contact_phone")),
    status: strOrUndefined(formData.get("status")),
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
    size: parsed.size,
    size_group: parsed.size_group,
    color: parsed.color ?? null,
    location: parsed.location,
    condition: parsed.condition,
    category: parsed.category,
    price: parsed.price,
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

    const { error: dbError } = await supabase.from("listings").insert(payload);
    if (dbError) {
      await deleteListingImages(uploadedUrls);
      return { error: dbError.message };
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
    .select("user_id, image_urls")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (!existing) return { error: "Listing not found" };
  if (existing.user_id !== user.id) return { error: "Not authorized" };

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

    const payload = listingRowPayload(parsed, nextImageUrls, nextBlurUrls);

    const { error: dbError } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);

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

    updateTag(`listing:${id}`);
    updateTag("listings");

    const orphans = oldImageUrls.filter((u) => !nextImageUrls.includes(u));
    if (orphans.length > 0) {
      await deleteListingImages(orphans);
    }

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
