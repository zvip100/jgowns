"use server";

import { revalidateTag, updateTag } from "next/cache";

import { getAuthClient } from "@/lib/actions/auth";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";

import type { ServerActionErrorResult } from "@/lib/types";
import type Stripe from "stripe";

const CHECKOUT_CANCEL_ERROR: ServerActionErrorResult = {
  error: "Couldn't cancel the open payment. Please try again.",
};

export async function revalidateListings() {
  revalidateTag("listings", "max");
}

/** Mark the whole listing sold: listing status + every size variant. */
export async function markListingSold(
  id: string,
): Promise<ServerActionErrorResult> {
  if (!id || typeof id !== "string") return { error: "Invalid listing id" };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase.rpc("mark_listing_sold", {
    p_listing_id: id,
  });

  if (error) return { error: error.message };

  updateTag(`listing:${id}`);
  updateTag("listings");
  return {};
}

/**
 * Soft-delete a seller-owned listing. Any open Checkout for a still-pending
 * fee is expired first so Remove can't leave a payable session that charges
 * without activating (activation only flips pending_payment → active).
 */
export async function removeListing(
  id: string,
): Promise<ServerActionErrorResult> {
  if (!id || typeof id !== "string") return { error: "Invalid listing id" };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { data: pendingPayments, error: pendingError } = await supabase
    .from("listing_payments")
    .select("stripe_session_id")
    .eq("listing_id", id)
    .eq("status", "pending");

  if (pendingError) return { error: pendingError.message };

  if (pendingPayments?.length) {
    const stripe = getStripe();
    const service = createServiceClient();

    for (const row of pendingPayments) {
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
      } catch (e) {
        console.error("Failed to retrieve Checkout session on remove:", e);
        return CHECKOUT_CANCEL_ERROR;
      }

      // Paid but not yet activated: don't expire or soft-remove; let confirm/webhook finish.
      if (session.payment_status === "paid") {
        return {
          error: "Payment is completing. Refresh and try again.",
        };
      }

      if (session.status === "open") {
        try {
          await stripe.checkout.sessions.expire(row.stripe_session_id);
        } catch (e) {
          console.error("Failed to expire Checkout session on remove:", e);
          return CHECKOUT_CANCEL_ERROR;
        }
      }

      const { error: expireError } = await service
        .from("listing_payments")
        .update({ status: "expired" })
        .eq("stripe_session_id", row.stripe_session_id)
        .eq("status", "pending");

      if (expireError) return { error: expireError.message };
    }
  }

  const { error } = await supabase.rpc("remove_listing", {
    p_listing_id: id,
  });

  if (error) {
    if (error.code === "P0002") return { error: "Listing not found" };
    return { error: error.message };
  }

  updateTag(`listing:${id}`);
  updateTag("listings");
  return {};
}

/** Mark a single size variant sold; if it was the last available one, the listing goes sold too. */
export async function markSizeSold(
  listingId: string,
  sizeId: string,
): Promise<ServerActionErrorResult> {
  if (!listingId || typeof listingId !== "string") {
    return { error: "Invalid listing id" };
  }
  if (!sizeId || typeof sizeId !== "string") {
    return { error: "Invalid size id" };
  }

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase.rpc("mark_size_sold", {
    p_listing_id: listingId,
    p_size_id: sizeId,
  });

  if (error) return { error: error.message };

  updateTag(`listing:${listingId}`);
  updateTag("listings");
  return {};
}

/** Reactivate a sold listing: listing status + every size variant back to available. */
export async function reactivateListing(
  id: string,
): Promise<ServerActionErrorResult> {
  if (!id || typeof id !== "string") return { error: "Invalid listing id" };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase.rpc("reactivate_listing", {
    p_listing_id: id,
  });

  if (error) return { error: error.message };

  updateTag(`listing:${id}`);
  updateTag("listings");
  return {};
}

/** Reactivate a single sold size variant; only while the parent listing is active. */
export async function reactivateSize(
  listingId: string,
  sizeId: string,
): Promise<ServerActionErrorResult> {
  if (!listingId || typeof listingId !== "string") {
    return { error: "Invalid listing id" };
  }
  if (!sizeId || typeof sizeId !== "string") {
    return { error: "Invalid size id" };
  }

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("status")
    .eq("id", listingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listingError) return { error: listingError.message };
  if (!listing) return { error: "Listing not found" };
  if (listing.status !== "active") {
    return { error: "Reactivate the listing before changing its sizes" };
  }

  const { data: updated, error } = await supabase
    .from("listing_sizes")
    .update({ status: "available" })
    .eq("id", sizeId)
    .eq("listing_id", listingId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Size not found" };

  updateTag(`listing:${listingId}`);
  updateTag("listings");
  return {};
}
