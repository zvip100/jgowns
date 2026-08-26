"use server";

import { updateTag } from "next/cache";

import { runAdminAction } from "@/lib/admin/guard";
import { deleteListingImages } from "@/lib/actions/images";
import {
  listingRowPayload,
  rawListingFieldsFromFormData,
  variantRowsPayload,
  zodListingFormErrorMessage,
} from "@/lib/listing-form";
import { listingInputSchema } from "@/lib/validations/listing-schema";
import {
  adminListingIdSchema,
  adminSizeIdSchema,
  removeListingImageSchema,
  suspendListingSchema,
} from "@/lib/validations/admin/listing-schema";

import type { ListingStatus, ServerActionErrorResult } from "@/lib/types";
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
  return { error: "Something went wrong. Please try again." };
}

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
    const parsed = removeListingImageSchema.safeParse({ listingId, imageUrl });
    if (!parsed.success) return { error: "Invalid image" };

    const { error } = await supabase.rpc("admin_remove_listing_image", {
      p_listing_id: parsed.data.listingId,
      p_image_url: parsed.data.imageUrl,
    });

    if (error) {
      if (error.code === "P0002") return { error: "Photo not found" };
      if (error.code === "23514") {
        return { error: "A listing must keep at least one photo." };
      }
      return rpcError(error);
    }

    // The row is committed, so the object is now an orphan. A storage failure
    // leaves a stray file, which the Phase 4 orphan finder exists to sweep; it
    // must not turn a completed moderation into an error.
    const cleanup = await deleteListingImages([parsed.data.imageUrl]);
    if ("error" in cleanup) {
      console.warn("[actions/admin/listings] Failed to delete moderated photo", {
        listingId: parsed.data.listingId,
        error: cleanup.error,
      });
    }

    invalidateListing(parsed.data.listingId);
    return {};
  });
}
