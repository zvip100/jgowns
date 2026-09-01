import "server-only";
import { randomUUID } from "node:crypto";

import type { SupabaseServer } from "@/lib/actions/auth";

/**
 * Where listing images live and how their public URLs map back to bucket paths.
 * Kept apart from `pipeline.ts` so storage addressing and image transformation
 * stay independently importable.
 */
export const LISTING_IMAGE_BUCKET = "gown-images";

const UPLOAD_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Objects an admin uploaded on a seller's behalf. See `listingId` below. */
export const ADMIN_UPLOAD_PREFIX = "admin";

type UploadListingImageArgs = {
  supabase: SupabaseServer;
  body: File | Buffer;
  contentType: string;
  /**
   * Admin paths only. An object uploaded by an admin is owned by the ADMIN in
   * `storage.objects`, so the seller who later removes that photo from their
   * own dashboard cannot delete the file. Writing it under
   * `admin/<listing_id>/` is what lets a storage policy grant that delete back:
   * the prefix is composed here from an id the action already validated, and a
   * seller cannot move an object into a different prefix, so it is provenance
   * they cannot forge. Keying on `listings.image_urls` instead would not be,
   * since that column is seller-writable.
   */
  listingId?: string;
};

/**
 * Always a fresh path, never an overwrite: a public URL is cached by the CDN
 * and by Next's image optimizer, so reusing a path would keep serving the old
 * bytes, and a half-failed overwrite would destroy the only copy.
 */
export async function uploadListingImage({
  supabase,
  body,
  contentType,
  listingId,
}: UploadListingImageArgs): Promise<string> {
  const ext = UPLOAD_EXT_BY_MIME[contentType] ?? "jpg";
  const name = `${randomUUID()}-${Date.now()}.${ext}`;
  const path = listingId
    ? `${ADMIN_UPLOAD_PREFIX}/${listingId}/${name}`
    : name;

  const { error: uploadError } = await supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .upload(path, body, { contentType });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/** Storage hands back a Blob; sharp needs a Buffer. */
export async function downloadListingImage(
  supabase: SupabaseServer,
  url: string,
): Promise<Buffer> {
  const path = listingImagePathFromUrl(url);
  if (!path) throw new Error("Image is not stored in this project's bucket.");

  const { data, error } = await supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .download(path);

  if (error || !data) {
    throw new Error(error?.message ?? "Image could not be downloaded.");
  }

  return Buffer.from(await data.arrayBuffer());
}

export function listingImagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const tail = u.pathname.slice(idx + marker.length);
    return tail ? decodeURIComponent(tail) : null;
  } catch {
    return null;
  }
}
