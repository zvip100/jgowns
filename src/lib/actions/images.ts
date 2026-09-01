"use server";

import { getAuthClient, type SupabaseServer } from "@/lib/actions/auth";
import {
  blurPlaceholderDataUrl,
  processListingImage,
} from "@/lib/images/pipeline";
import {
  LISTING_IMAGE_BUCKET,
  listingImagePathFromUrl,
} from "@/lib/images/storage";

export type OptimizeListingPhotoResult =
  | { dataUrl: string; blurDataUrl: string | null }
  | { error: string };

export type DeleteListingImageResult = { ok: true } | { error: string };

/**
 * Runs the shared pipeline for the seller's upload form and hands the result
 * back as a data URL, which the form re-uploads once the listing is submitted.
 *
 * A Vision outage is deliberately not an error here: the seller gets a
 * correctly cropped, correctly sized WebP either way, and blocking the sale on
 * Google being reachable would be worse than publishing a photo an admin can
 * reprocess later (adminReprocessListingImage).
 */
export async function optimizeListingPhoto(
  formData: FormData,
): Promise<OptimizeListingPhotoResult> {
  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };

  const file = formData.get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return { error: "Please upload a valid image file." };
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processListingImage(input);

    return {
      dataUrl: `data:image/webp;base64,${processed.webp.toString("base64")}`,
      blurDataUrl: await blurPlaceholderDataUrl(processed.webp),
    };
  } catch (e) {
    console.error("optimizeListingPhoto failed:", e);
    return {
      error:
        e instanceof Error && e.message
          ? e.message
          : "Image optimization failed.",
    };
  }
}

type StorageCapableClient = { storage: SupabaseServer["storage"] };

/**
 * Removes previously uploaded listing images from Supabase Storage.
 *
 * Safe to call with any URLs: non-Supabase URLs (e.g. legacy Cloudinary)
 * are skipped silently. Security is enforced by the storage RLS policy
 * "Users can delete own images" — only the original uploader can delete
 * their own files.
 *
 * Session-based callers (the create/edit actions) omit `client` and get the
 * caller's own session, gated by that RLS policy. The retention cleanup
 * sweep runs with no user session, so it passes the service-role client
 * explicitly, which bypasses storage RLS the same way it bypasses table RLS.
 */
export async function deleteListingImages(
  imageUrls: string[],
  client?: StorageCapableClient,
): Promise<DeleteListingImageResult> {
  const paths = imageUrls
    .map((url) => listingImagePathFromUrl(url))
    .filter((p): p is string => p !== null);

  if (paths.length === 0) return { ok: true };

  let supabase = client;
  if (!supabase) {
    const auth = await getAuthClient();
    if (!auth.ok) return { error: auth.error };
    supabase = auth.supabase;
  }

  const { error } = await supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .remove(paths);

  if (error) {
    console.warn("deleteListingImages failed:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}
