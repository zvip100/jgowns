"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { isListingFeeActive } from "@/lib/listing-fee";
import {
  listingFormActionError,
  listingRowPayload,
  rawListingFieldsFromFormData,
  strOrUndefined,
  variantRowsPayload,
} from "@/lib/listing-form";
import {
  MAX_BLUR_DATA_URL_LENGTH,
  MAX_LISTING_IMAGES,
  type ServerActionErrorResult,
} from "@/lib/types";
import { imageSlotFormKeys } from "@/lib/utils";
import { getAuthClient } from "@/lib/actions/auth";
import { createListingCheckout } from "@/lib/actions/payments";
import { deleteListingImages } from "@/lib/actions/images";
import { uploadListingImage } from "@/lib/images/storage";
import { listingInputSchema } from "@/lib/validations/listing-schema";

/** One-shot flag consumed by DashboardFlashToast, mirroring the edit flow. */
const CHECKOUT_UNAVAILABLE_REDIRECT = "/dashboard?toast=checkout-unavailable";

type ImageSlot = {
  file: File | null;
  existingUrl: string | null;
  blur: string;
};

function fileOrNull(value: FormDataEntryValue | null): File | null {
  if (!value) return null;
  if (typeof value === "string") return null;
  return value;
}

/** Blur strings are client-generated tiny data URLs; reject anything else. */
function sanitizeBlur(value: FormDataEntryValue | null): string {
  const blur = strOrUndefined(value);
  if (!blur) return "";
  if (!blur.startsWith("data:image/")) return "";
  if (blur.length > MAX_BLUR_DATA_URL_LENGTH) return "";
  return blur;
}

/** Collect image slots from formData, compacted (skip empty slots), at least 1 required. */
function collectImageSlots(
  formData: FormData,
): ImageSlot[] | { error: string } {
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

export async function createListing(
  formData: FormData,
): Promise<ServerActionErrorResult> {
  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  const feeActive = isListingFeeActive();
  let shouldRedirect = false;
  let createdListingId: string | null = null;
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
      files.map((file) =>
        uploadListingImage({ supabase, body: file, contentType: file.type }),
      ),
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
      ...listingRowPayload(
        parsed,
        uploadedUrls,
        image_blur_data_urls,
        feeActive ? "pending_payment" : "active",
      ),
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

    createdListingId = created.id as string;
    // A pending listing is invisible to browse until it activates, so there's
    // nothing to invalidate yet in the fee-active branch (see §6.1 instead).
    if (!feeActive) updateTag("listings");
    shouldRedirect = true;
  } catch (e) {
    if (uploadedUrls.length > 0) await deleteListingImages(uploadedUrls);
    return listingFormActionError(e);
  }

  // Runs after the try/catch on purpose: the listing + variants are already
  // committed by this point, so a Checkout-creation failure must never delete
  // the seller's work.
  if (shouldRedirect && createdListingId) {
    if (feeActive) {
      const checkout = await createListingCheckout(createdListingId);
      // Only reachable when checkout failed; success redirects to Stripe. The
      // listing is committed, so leave the populated form behind rather than
      // returning the error into it and inviting a duplicate submission. The
      // flag carries the reason across the redirect (DashboardFlashToast).
      if (checkout?.error) redirect(CHECKOUT_UNAVAILABLE_REDIRECT);
      return checkout;
    }
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
  // Active (live) and pending_payment (saved, fee unpaid) are editable.
  // Sold/removed stay blocked; editing never flips status (RPC ignores it).
  if (
    existing.status !== "active" &&
    existing.status !== "pending_payment"
  ) {
    return { error: "Only active or unpaid listings can be edited." };
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
          ? uploadListingImage({
              supabase,
              body: slot.file,
              contentType: slot.file.type,
            })
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

    // An edit never changes listing status: the RPC ignores the status column,
    // and sold/removed listings are rejected above. Status transitions go
    // through their dedicated actions / payment confirmation.
    const payload = listingRowPayload(
      parsed,
      nextImageUrls,
      nextBlurUrls,
      existing.status,
    );

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
    if (newlyUploadedUrls.length > 0)
      await deleteListingImages(newlyUploadedUrls);
    return listingFormActionError(e);
  }

  if (shouldRedirect) {
    // One-shot flag consumed by DashboardFlashToast to confirm the edit.
    redirect("/dashboard?toast=listing-updated");
  }
  return {};
}
