"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidSizePair } from "@/lib/gown-sizes";
import {
  GOWN_CATEGORIES,
  SIZE_GROUPS,
  type GownCategoryId,
  type ServerActionErrorResult,
} from "@/lib/types";
import { getAuthClient, type SupabaseServer } from "@/lib/actions/auth";
import { deleteListingImage } from "@/lib/actions/images";

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
    image_url: z.url().optional(),
    image_blur_data_url: z.string().trim().optional(),
    contact_email: z.email(),
    contact_phone: contactPhoneField,
    status: z.enum(["active", "sold", "removed"]).default("active"),
  })
  .refine((data) => isValidSizePair(data.category, data.size_group, data.size), {
    message: "Size is not valid for this category.",
    path: ["size"],
  });

type ParsedListing = z.infer<typeof listingInputSchema>;

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
    image_url: strOrUndefined(formData.get("image_url")),
    image_blur_data_url: strOrUndefined(formData.get("image_blur_data_url")),
    contact_email: formData.get("contact_email"),
    contact_phone: strOrUndefined(formData.get("contact_phone")),
    status: strOrUndefined(formData.get("status")),
  };
}

function listingRowPayload(parsed: ParsedListing, image_url: string) {
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
    image_url,
    image_blur_data_url: parsed.image_blur_data_url ?? null,
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

/** Update path: new file wins; otherwise keep parsed URL; must end with a non-empty URL. */
async function resolveUpdateListingImageUrl(
  supabase: SupabaseServer,
  userId: string,
  imageFile: File | null,
  parsed: ParsedListing,
): Promise<{ image_url: string } | { error: string }> {
  if (imageFile) {
    const image_url = await uploadListingImage({
      supabase,
      file: imageFile,
    });
    return { image_url };
  }

  const image_url = parsed.image_url;
  if (!image_url) {
    return { error: "Please add a gown photo." };
  }
  return { image_url };
}

export async function createListing(
  formData: FormData,
): Promise<ServerActionErrorResult> {
  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  let shouldRedirect = false;

  try {
    const imageFile = fileOrNull(formData.get("image_file"));

    if (!imageFile) {
      return { error: "Please add a gown photo." };
    }

    const parsed = listingInputSchema.parse(
      rawListingFieldsFromFormData(formData),
    );

    const image_url = await uploadListingImage({
      supabase,
      file: imageFile,
    });

    const payload = {
      ...listingRowPayload(parsed, image_url),
      user_id: user.id,
    };

    const { error: dbError } = await supabase.from("listings").insert(payload);
    if (dbError) return { error: dbError.message };

    updateTag("listings");
    shouldRedirect = true;
  } catch (e) {
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
    .select("user_id, image_url")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (!existing) return { error: "Listing not found" };
  if (existing.user_id !== user.id) return { error: "Not authorized" };

  const oldImageUrl: string | null = existing.image_url ?? null;

  let shouldRedirect = false;

  try {
    const imageFile = fileOrNull(formData.get("image_file"));

    const parsed = listingInputSchema.parse(
      rawListingFieldsFromFormData(formData),
    );

    const image = await resolveUpdateListingImageUrl(
      supabase,
      user.id,
      imageFile,
      parsed,
    );
    if ("error" in image) return { error: image.error };

    const payload = listingRowPayload(parsed, image.image_url);

    const { error: dbError } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbError) {
      if (imageFile) {
        const cleanup = await deleteListingImage(image.image_url);
        if ("error" in cleanup) {
          console.warn(
            "Failed to clean up replacement image after listing update error:",
            {
              listingId: id,
              oldImageUrl,
              replacementImageUrl: image.image_url,
              error: cleanup.error,
            },
          );
        }
      }
      return { error: dbError.message };
    }

    updateTag(`listing:${id}`);
    updateTag("listings");

    if (imageFile && oldImageUrl && oldImageUrl !== image.image_url) {
      await deleteListingImage(oldImageUrl);
    }

    shouldRedirect = true;
  } catch (e) {
    return catchSellActionError(e);
  }

  if (shouldRedirect) {
    redirect("/dashboard");
  }
  return {};
}
