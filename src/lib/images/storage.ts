import "server-only";
import { randomUUID } from "node:crypto";

import type { createServiceClient } from "@/lib/supabase/service";
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

/**
 * Of `imageUrls`, the ones no listing shows any more. `listings.image_urls` is
 * written verbatim by `update_listing_with_variants`, which validates the
 * array's contents nowhere, so a seller can point their own row at another
 * listing's photo. Every privileged delete path (the two sweeps and admin photo
 * moderation) removes with authority that reaches the whole bucket (an admin's
 * storage policy, or the service role), so each re-checks what it collected
 * once its own rows are gone and removes only what nothing points at.
 */
export async function unreferencedListingImageUrls(
  service: ReturnType<typeof createServiceClient> | SupabaseServer,
  imageUrls: string[],
): Promise<string[]> {
  if (imageUrls.length === 0) return [];

  const { data, error } = await service
    .from("listings")
    .select("image_urls")
    .overlaps("image_urls", imageUrls);

  if (error) {
    console.error("[images/storage] Failed to check image references", {
      message: error.message,
    });
    // Provenance unknown, so nothing is swept: a stray object costs storage,
    // deleting a referenced one breaks a listing that is still on the market.
    return [];
  }

  const stillReferenced = new Set(
    (data ?? []).flatMap((row) => (row.image_urls ?? []) as string[]),
  );

  return imageUrls.filter((url) => !stillReferenced.has(url));
}

/** Read per call, not at module load: vitest sets the env after import. */
function listingImageOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

/**
 * The bucket path of a canonical public URL, or null for anything else.
 *
 * Strict on purpose. The reference check above compares whole URL strings while
 * both privileged sweeps delete by the path this returns, so any alias
 * resolving to the same object (a foreign origin, a query string, a re-escaped
 * segment) would pass that check as a different photo and then delete a live
 * listing's file. Accepting only the exact form `getPublicUrl` produces keeps
 * the two views of an object in agreement.
 */
export function listingImagePathFromUrl(url: string): string | null {
  const projectOrigin = listingImageOrigin();
  if (!projectOrigin) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Exact canonical form only. URL parsing folds an uppercase host, an explicit
  // :443, and embedded credentials into a matching origin, so those strings pass
  // an origin comparison while missing the whole-string reference check above.
  if (
    parsed.origin !== projectOrigin ||
    `${parsed.origin}${parsed.pathname}` !== url
  ) {
    return null;
  }

  const marker = `/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/`;
  if (!parsed.pathname.startsWith(marker)) return null;

  const tail = parsed.pathname.slice(marker.length);
  if (!tail) return null;

  let path: string;
  try {
    path = decodeURIComponent(tail);
  } catch {
    return null;
  }

  return path.split("/").map(encodeURIComponent).join("/") === tail
    ? path
    : null;
}
