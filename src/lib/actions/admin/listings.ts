"use server";

import { updateTag } from "next/cache";

import { runAdminAction } from "@/lib/admin/guard";
import { deleteListingImages } from "@/lib/actions/images";
import {
  blurPlaceholderDataUrl,
  processListingImage,
} from "@/lib/images/pipeline";
import {
  downloadListingImage,
  uploadListingImage,
} from "@/lib/images/storage";
import {
  listingRowPayload,
  rawListingFieldsFromFormData,
  variantRowsPayload,
  zodListingFormErrorMessage,
} from "@/lib/listing-form";
import { MAX_LISTING_IMAGES } from "@/lib/types";
import { listingInputSchema } from "@/lib/validations/listing-schema";
import {
  adminListingIdSchema,
  adminSizeIdSchema,
  listingImageFileSchema,
  listingImageMoveSchema,
  listingImageTargetSchema,
  suspendListingSchema,
} from "@/lib/validations/admin/listing-schema";

import type { SupabaseServer } from "@/lib/actions/auth";
import type {
  ListingStatus,
  ServerActionErrorResult,
  ServerActionResult,
} from "@/lib/types";
import type { SuspendListingInput } from "@/lib/validations/admin/listing-schema";

/**
 * Admin listing writes. Every one runs on the operator's own authenticated
 * client, never the service client: the audit triggers derive the actor from
 * `auth.uid()`, so a service-role write would log as `system` and the log would
 * stop naming who moderated what. None of them writes an audit row either; the
 * triggers on `listings` and `listing_sizes` already emit one per change.
 */

type PostgrestLikeError = { message: string; code?: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  P0002: "Listing not found",
  "42501": "Not authorized",
  "22023": "Choose a valid reason.",
  "23514": "That change would leave the listing invalid.",
  "55000": "Reactivate the listing before changing its sizes",
};

const UNEXPECTED_RPC_ERROR = "Something went wrong. Please try again.";

/**
 * Postgres codes carry the meaning; the raised text is written for a developer
 * reading logs, so it is not returned to the client verbatim.
 */
function rpcError(error: PostgrestLikeError): ServerActionErrorResult {
  const mapped = error.code ? RPC_ERROR_MESSAGES[error.code] : undefined;
  if (mapped) return { error: mapped };
  console.error("[actions/admin/listings] RPC failed", {
    message: error.message,
    code: error.code,
  });
  return { error: UNEXPECTED_RPC_ERROR };
}

/**
 * Every photo action resolves its target from the listing's own array, so a
 * P0002 from any of the RPCs means the same thing: that photo is no longer
 * where the operator's page said it was, because someone else moderated it
 * first.
 */
const PHOTO_GONE_ERROR = "Photo not found";

/** Spelled out, like the remove action's "at least one photo" counterpart. */
const PHOTO_LIMIT_ERROR = "A listing can hold at most three photos.";

/**
 * Every listing write moves the same two caches: the collection tag behind
 * browse and the per-listing tag behind `/browse/[id]`.
 */
function invalidateListing(id: string): void {
  updateTag(`listing:${id}`);
  updateTag("listings");
}

export async function adminSuspendListing(
  listingId: string,
  input: SuspendListingInput,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminSuspendListing", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const parsed = suspendListingSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Choose a reason." };
    }

    const { error } = await supabase.rpc("admin_suspend_listing", {
      p_listing_id: id.data,
      p_slug: parsed.data.slug,
      p_note: parsed.data.note ?? null,
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

export async function adminRestoreListing(
  listingId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminRestoreListing", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const { error } = await supabase.rpc("admin_restore_listing", {
      p_listing_id: id.data,
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

/**
 * Soft-removes a listing on the seller's own explicit request, through the
 * same widened remove_listing() the seller's own RemoveListingButton uses.
 * Always restorable via adminRestoreListing regardless of who removed it, to
 * active if the listing had already gone live, otherwise to pending_payment.
 */
export async function adminRemoveListing(
  listingId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminRemoveListing", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const { error } = await supabase.rpc("remove_listing", {
      p_listing_id: id.data,
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

/** Support action, on the seller's behalf. Keeps the RPC's active-only guard. */
export async function adminMarkListingSold(
  listingId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminMarkListingSold", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const { error } = await supabase.rpc("mark_listing_sold", {
      p_listing_id: id.data,
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

/** Support action. Keeps the RPC's sold-only guard. */
export async function adminReactivateListing(
  listingId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminReactivateListing", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const { error } = await supabase.rpc("reactivate_listing", {
      p_listing_id: id.data,
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

export async function adminMarkSizeSold(
  listingId: string,
  sizeId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminMarkSizeSold", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };
    const size = adminSizeIdSchema.safeParse(sizeId);
    if (!size.success) return { error: "Invalid size id" };

    const { error } = await supabase.rpc("mark_size_sold", {
      p_listing_id: id.data,
      p_size_id: size.data,
    });

    if (error) {
      if (error.code === "P0002") return { error: "Size not found" };
      return rpcError(error);
    }

    invalidateListing(id.data);
    return {};
  });
}

/**
 * Mirrors the seller path. The active-parent precondition lives inside the RPC's
 * own UPDATE rather than in a read before it, so a suspend or mark-sold landing
 * in between cannot leave a variant available under a non-active listing.
 */
export async function adminReactivateSize(
  listingId: string,
  sizeId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminReactivateSize", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };
    const size = adminSizeIdSchema.safeParse(sizeId);
    if (!size.success) return { error: "Invalid size id" };

    const { error } = await supabase.rpc("reactivate_size", {
      p_listing_id: id.data,
      p_size_id: size.data,
    });

    if (error) {
      if (error.code === "P0002") return { error: "Size not found" };
      return rpcError(error);
    }

    invalidateListing(id.data);
    return {};
  });
}

/**
 * Allowed in any status because `update_listing_with_variants` never touches
 * `status`, so the status guard never fires. Photos are never taken from the
 * form and the payload omits the image keys entirely (not even re-read here):
 * the RPC preserves the row's own current arrays inside its own transaction,
 * so a concurrent admin's photo removal can't be raced back into existence by
 * a stale read (migration 033).
 */
export async function adminUpdateListing(
  listingId: string,
  formData: FormData,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminUpdateListing", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const { data: existing, error: existingError } = await supabase
      .from("listings")
      .select("status")
      .eq("id", id.data)
      .maybeSingle();

    if (existingError) return rpcError(existingError);
    if (!existing) return { error: "Listing not found" };

    const parsed = listingInputSchema.safeParse(
      rawListingFieldsFromFormData(formData),
    );
    // The Zod branch only. `listingFormActionError` returns a raw `e.message`
    // for anything else, which is right for the seller form's own throws but
    // would put PostgREST text on an operator's screen here.
    if (!parsed.success) {
      return { error: zodListingFormErrorMessage(parsed.error) };
    }

    const payload = listingRowPayload(
      parsed.data,
      undefined,
      undefined,
      // Cast because supabase-js widens a selected column to string; the CHECK
      // constraint is what actually bounds it. The RPC ignores status anyway.
      existing.status as ListingStatus,
    );

    const { error } = await supabase.rpc("update_listing_with_variants", {
      p_listing_id: id.data,
      p_listing: payload,
      p_variants: variantRowsPayload(parsed.data),
    });

    if (error) return rpcError(error);

    invalidateListing(id.data);
    return {};
  });
}

/* --------------------------------------------------------------------------
 * Photos
 *
 * Four write paths over four RPCs, all sharing one rule: the row commits first
 * and storage moves after, because storage cannot join the transaction. Every
 * RPC returns the array it actually committed, and an object is deleted only
 * when that array no longer references it — `listings_image_arrays_check`
 * bounds count and parity but not uniqueness, so a listing carrying the same
 * URL twice would otherwise have one index rewritten while the other still
 * pointed at the file being removed.
 * ----------------------------------------------------------------------- */

const PHOTO_PIPELINE_ERROR = "This photo could not be processed.";
const PHOTO_VISION_ERROR =
  "Face detection is unavailable right now. Try again later.";

/** Whether a face was found is the only question the operator has. */
function photoNotice(verb: string, facesDetected: number): string {
  if (facesDetected === 0) return `${verb} No faces were detected.`;
  const noun = facesDetected === 1 ? "face" : "faces";
  return `${verb} ${facesDetected} ${noun} blurred.`;
}

type PreparedPhoto = {
  ok: true;
  url: string;
  blur: string | null;
  facesDetected: number;
};

/**
 * Runs the shared pipeline over a buffer and puts the result in storage, under
 * the admin prefix so the seller can still delete it later.
 *
 * Refuses when face detection could not RUN, before anything is written. The
 * seller upload deliberately tolerates a Vision outage, because blocking there
 * blocks a sale; an admin adding a photo on someone's behalf can simply retry,
 * and a photo landing unblurred is a privacy problem.
 */
async function prepareListingPhoto(
  supabase: SupabaseServer,
  listingId: string,
  input: Buffer,
  scope: string,
  uploadError: string,
): Promise<PreparedPhoto | ServerActionErrorResult> {
  let processed;
  try {
    processed = await processListingImage(input);
  } catch (e) {
    console.error(`[actions/admin/listings] ${scope} pipeline failed`, {
      listingId,
      error: e,
    });
    return { error: PHOTO_PIPELINE_ERROR };
  }

  if (!processed.visionOk) return { error: PHOTO_VISION_ERROR };

  try {
    const url = await uploadListingImage({
      supabase,
      body: processed.webp,
      contentType: "image/webp",
      listingId,
    });
    return {
      ok: true,
      url,
      blur: await blurPlaceholderDataUrl(processed.webp),
      facesDetected: processed.facesDetected,
    };
  } catch (e) {
    console.error(`[actions/admin/listings] ${scope} upload failed`, {
      listingId,
      error: e,
    });
    return { error: uploadError };
  }
}

/**
 * The asymmetric rollback every write-then-swap path shares. A STRUCTURED
 * rejection (`error.code` present) means PostgREST relayed a Postgres error, so
 * the transaction rolled back and the fresh upload is the orphan. An unknown
 * transport outcome carries no code and may be hiding a swap that DID commit,
 * where deleting would strand the listing on a missing object; a stray file is
 * the safe side of that ambiguity.
 */
async function rollBackUnusedUpload(
  supabase: SupabaseServer,
  listingId: string,
  newUrl: string,
  error: PostgrestLikeError,
): Promise<void> {
  if (!error.code) {
    console.warn(
      "[actions/admin/listings] Photo write outcome unknown; keeping the upload",
      { listingId, imageUrl: newUrl },
    );
    return;
  }
  try {
    const rollback = await deleteListingImages([newUrl], supabase);
    if ("error" in rollback) {
      console.warn("[actions/admin/listings] Photo write left a stray upload", {
        listingId,
        imageUrl: newUrl,
        error: rollback.error,
      });
    }
  } catch (e) {
    console.warn("[actions/admin/listings] Photo rollback threw", {
      listingId,
      imageUrl: newUrl,
      error: e,
    });
  }
}

/**
 * Drops an object the committed row no longer references. Warn-only either way:
 * the row is already correct, and the orphan sweep is the cleanup, so a storage
 * failure must not turn a completed moderation into an error.
 *
 * `supabase` is the already-authorized client. Without it the helper reacquires
 * a session, which is a redundant getUser() round-trip on a path that has
 * already committed, and one more way for it to fail.
 */
async function deleteDereferencedObject(
  supabase: SupabaseServer,
  listingId: string,
  imageUrl: string,
  committedUrls: string[] | null | undefined,
): Promise<void> {
  // No array at all means the deployed function is the older void-returning
  // one, so nothing here can prove the URL is gone. Same rule as the rollback
  // branch: when the outcome is unknown, a stray file beats a listing pointing
  // at an object that no longer exists.
  if (!committedUrls || committedUrls.includes(imageUrl)) {
    console.warn(
      "[actions/admin/listings] Photo may still be referenced after the write; keeping the object",
      { listingId, imageUrl, hadCommittedArray: Boolean(committedUrls) },
    );
    return;
  }

  try {
    const cleanup = await deleteListingImages([imageUrl], supabase);
    if ("error" in cleanup) {
      console.warn("[actions/admin/listings] Failed to delete a replaced photo", {
        listingId,
        error: cleanup.error,
      });
    }
  } catch (e) {
    console.warn("[actions/admin/listings] Photo cleanup threw", {
      listingId,
      error: e,
    });
  }
}

/**
 * The RPC resolves the index from the listing's own stored array, so no bucket
 * path here is trusted: `deleteListingImages` removes whatever it is handed.
 * Order matters and mirrors `sell.ts`: the arrays commit first, the object goes
 * after, because storage cannot join the transaction.
 */
export async function adminRemoveListingImage(
  listingId: string,
  imageUrl: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminRemoveListingImage", async ({ supabase }) => {
    const parsed = listingImageTargetSchema.safeParse({ listingId, imageUrl });
    if (!parsed.success) return { error: "Invalid image" };

    const { data, error } = await supabase.rpc("admin_remove_listing_image", {
      p_listing_id: parsed.data.listingId,
      p_image_url: parsed.data.imageUrl,
    });

    if (error) {
      if (error.code === "P0002") return { error: PHOTO_GONE_ERROR };
      if (error.code === "23514") {
        return { error: "A listing must keep at least one photo." };
      }
      return rpcError(error);
    }

    await deleteDereferencedObject(
      supabase,
      parsed.data.listingId,
      parsed.data.imageUrl,
      data,
    );

    invalidateListing(parsed.data.listingId);
    return {};
  });
}

/**
 * Re-runs the shared image pipeline on a photo that is already live, and swaps
 * the result in. The reason it exists: a Vision outage during the seller's
 * upload is not fatal there, so a photo can go live correctly cropped and
 * sized but with no face blur, and nothing about it looks wrong afterwards.
 *
 * Zero faces on a successful detection is a real outcome and commits, with a
 * `notice` saying so, because whether a face was found is the only question the
 * operator has.
 */
export async function adminReprocessListingImage(
  listingId: string,
  imageUrl: string,
): Promise<ServerActionResult> {
  return runAdminAction("adminReprocessListingImage", async ({ supabase }) => {
    const parsed = listingImageTargetSchema.safeParse({ listingId, imageUrl });
    if (!parsed.success) return { error: "Invalid image" };

    const listing = await readListingImageUrls(supabase, parsed.data.listingId);
    if (!("ok" in listing)) return listing;
    if (!listing.urls.includes(parsed.data.imageUrl)) {
      return { error: PHOTO_GONE_ERROR };
    }

    let original: Buffer;
    try {
      original = await downloadListingImage(supabase, parsed.data.imageUrl);
    } catch (e) {
      console.error("[actions/admin/listings] Reprocess download failed", {
        listingId: parsed.data.listingId,
        error: e,
      });
      return { error: PHOTO_PIPELINE_ERROR };
    }

    const prepared = await prepareListingPhoto(
      supabase,
      parsed.data.listingId,
      original,
      "Reprocess",
      "The reprocessed photo could not be saved.",
    );
    if (!("ok" in prepared)) return prepared;

    return swapInPhoto({
      supabase,
      listingId: parsed.data.listingId,
      oldUrl: parsed.data.imageUrl,
      prepared,
      auditAction: "listing.image_reprocess",
      verb: "Photo reprocessed.",
    });
  });
}

/**
 * Replaces a live photo with a different one an operator received out of band,
 * by email or text. The old object is deleted only after the new photo has
 * passed the pipeline, reached storage, and the row swap has committed. Never
 * before: every earlier failure leaves the listing exactly as it was.
 */
export async function adminReplaceListingImage(
  listingId: string,
  imageUrl: string,
  formData: FormData,
): Promise<ServerActionResult> {
  return runAdminAction("adminReplaceListingImage", async ({ supabase }) => {
    const parsed = listingImageTargetSchema.safeParse({ listingId, imageUrl });
    if (!parsed.success) return { error: "Invalid image" };

    const file = listingImageFileSchema.safeParse(formData.get("photo"));
    if (!file.success) {
      return { error: file.error.issues[0]?.message ?? "Choose a photo." };
    }

    const listing = await readListingImageUrls(supabase, parsed.data.listingId);
    if (!("ok" in listing)) return listing;
    // Cheap pre-check so an unknown URL costs no pipeline run. The RPC's own
    // array_position under its row lock is what actually decides.
    if (!listing.urls.includes(parsed.data.imageUrl)) {
      return { error: PHOTO_GONE_ERROR };
    }

    const prepared = await prepareListingPhoto(
      supabase,
      parsed.data.listingId,
      Buffer.from(await file.data.arrayBuffer()),
      "Replace",
      "The replacement photo could not be saved.",
    );
    if (!("ok" in prepared)) return prepared;

    return swapInPhoto({
      supabase,
      listingId: parsed.data.listingId,
      oldUrl: parsed.data.imageUrl,
      prepared,
      auditAction: "listing.image_replace",
      verb: "Photo replaced.",
    });
  });
}

/**
 * Adds a photo an operator received out of band, on the seller's behalf. The
 * RPC refuses at three regardless of what the page rendered, because a stale
 * tab is a reachable path and a hidden button is not enforcement.
 */
export async function adminAddListingImage(
  listingId: string,
  formData: FormData,
): Promise<ServerActionResult> {
  return runAdminAction("adminAddListingImage", async ({ supabase }) => {
    const id = adminListingIdSchema.safeParse(listingId);
    if (!id.success) return { error: "Invalid listing id" };

    const file = listingImageFileSchema.safeParse(formData.get("photo"));
    if (!file.success) {
      return { error: file.error.issues[0]?.message ?? "Choose a photo." };
    }

    const listing = await readListingImageUrls(supabase, id.data);
    if (!("ok" in listing)) return listing;
    // Same cheap pre-check as replace: the common rejection should not cost a
    // download, a Vision call, and an upload before the database says no.
    if (listing.urls.length >= MAX_LISTING_IMAGES) {
      return { error: PHOTO_LIMIT_ERROR };
    }

    const prepared = await prepareListingPhoto(
      supabase,
      id.data,
      Buffer.from(await file.data.arrayBuffer()),
      "Add",
      "The photo could not be saved.",
    );
    if (!("ok" in prepared)) return prepared;

    const { error } = await supabase.rpc("admin_append_listing_image", {
      p_listing_id: id.data,
      p_new_url: prepared.url,
      p_new_blur: prepared.blur,
    });

    if (error) {
      await rollBackUnusedUpload(supabase, id.data, prepared.url, error);
      if (error.code === "23514") return { error: PHOTO_LIMIT_ERROR };
      if (error.code === "22023") return { error: UNEXPECTED_RPC_ERROR };
      return rpcError(error);
    }

    invalidateListing(id.data);
    return { notice: photoNotice("Photo added.", prepared.facesDetected) };
  });
}

/**
 * Moves one photo one position. Photo 1 is the listing's cover image, so this
 * is a real capability rather than a nicety.
 *
 * Not confirm-gated, a deliberate departure from every other admin write: a
 * reorder is trivially reversible and is used repeatedly in a row, and a dialog
 * per nudge would make it unusable. No storage work at all.
 */
export async function adminMoveListingImage(
  listingId: string,
  position: number,
  imageUrl: string,
  offset: number,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminMoveListingImage", async ({ supabase }) => {
    const parsed = listingImageMoveSchema.safeParse({
      listingId,
      imageUrl,
      position,
      offset,
    });
    if (!parsed.success) return { error: "Invalid move" };

    const { error } = await supabase.rpc("admin_move_listing_image", {
      p_listing_id: parsed.data.listingId,
      p_index: parsed.data.position,
      p_expected_url: parsed.data.imageUrl,
      p_offset: parsed.data.offset,
    });

    if (error) {
      if (error.code === "P0002") return { error: PHOTO_GONE_ERROR };
      // Covers all three refusals the RPC raises under this code: an index that
      // is not on the listing, an end already reached, and two byte-identical
      // photos. Each of them means the operator's page no longer matches.
      if (error.code === "22023") {
        return { error: "That move is no longer possible. Refresh the page." };
      }
      return rpcError(error);
    }

    invalidateListing(parsed.data.listingId);
    return {};
  });
}

type SwapInPhotoArgs = {
  supabase: SupabaseServer;
  listingId: string;
  oldUrl: string;
  prepared: PreparedPhoto;
  auditAction: "listing.image_reprocess" | "listing.image_replace";
  verb: string;
};

/**
 * The half reprocess and replace share: commit the swap, then drop the object
 * the committed array no longer references. Split out because the two differ
 * only in where the new bytes came from and what the log should call it.
 */
async function swapInPhoto({
  supabase,
  listingId,
  oldUrl,
  prepared,
  auditAction,
  verb,
}: SwapInPhotoArgs): Promise<ServerActionResult> {
  const { data, error } = await supabase.rpc("admin_replace_listing_image", {
    p_listing_id: listingId,
    p_old_url: oldUrl,
    p_new_url: prepared.url,
    p_new_blur: prepared.blur,
    p_audit_action: auditAction,
  });

  if (error) {
    await rollBackUnusedUpload(supabase, listingId, prepared.url, error);
    if (error.code === "P0002") return { error: PHOTO_GONE_ERROR };
    // The whitelist only rejects a slug this file never sends, so a 22023 here
    // is a bug rather than something an operator can fix; the shared map's
    // "Choose a valid reason." belongs to suspend and would be nonsense.
    if (error.code === "22023") return { error: UNEXPECTED_RPC_ERROR };
    return rpcError(error);
  }

  await deleteDereferencedObject(supabase, listingId, oldUrl, data);

  invalidateListing(listingId);
  return { notice: photoNotice(verb, prepared.facesDetected) };
}

/** The one read both add and replace make before spending a pipeline run. */
async function readListingImageUrls(
  supabase: SupabaseServer,
  listingId: string,
): Promise<{ ok: true; urls: string[] } | ServerActionErrorResult> {
  const { data, error } = await supabase
    .from("listings")
    .select("image_urls")
    .eq("id", listingId)
    .maybeSingle();

  if (error) return rpcError(error);
  if (!data) return { error: "Listing not found" };
  return { ok: true, urls: data.image_urls as string[] };
}
