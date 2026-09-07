"use server";

import { revalidateTag, updateTag } from "next/cache";

import { captureServerError } from "@/lib/analytics/server";
import { getAuthClient } from "@/lib/actions/auth";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";

import type { ServerActionErrorResult } from "@/lib/types";
import type Stripe from "stripe";

const CHECKOUT_CANCEL_ERROR: ServerActionErrorResult = {
  error: "Couldn't cancel the open payment. Please try again.",
};

const GENERIC_RPC_ERROR = "Something went wrong. Please try again.";

type PostgrestLikeError = { message: string; code?: string };

/**
 * Postgres codes carry the meaning; the raised text is written for a developer
 * reading logs, so an unmapped code never reaches the seller's screen verbatim.
 */
function rpcError(
  scope: string,
  error: PostgrestLikeError,
  codeMessages?: Record<string, string>,
): ServerActionErrorResult {
  const mapped = codeMessages && error.code ? codeMessages[error.code] : undefined;
  if (mapped) return { error: mapped };
  console.error(`[actions/listings] ${scope} RPC failed`, error);
  return { error: GENERIC_RPC_ERROR };
}

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

  if (error) {
    return rpcError("markListingSold", error, { P0002: "Listing not found" });
  }

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
        await captureServerError(
          { scope: "listings.removeListing.retrieveSession" },
          e,
        );
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
          await captureServerError(
            { scope: "listings.removeListing.expireSession" },
            e,
          );
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
    return rpcError("removeListing", error, { P0002: "Listing not found" });
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

  if (error) {
    return rpcError("markSizeSold", error, { P0002: "Size not found" });
  }

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

  if (error) {
    return rpcError("reactivateListing", error, { P0002: "Listing not found" });
  }

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
  const { supabase } = auth;

  const { error } = await supabase.rpc("reactivate_size", {
    p_listing_id: listingId,
    p_size_id: sizeId,
  });

  if (error) {
    return rpcError("reactivateSize", error, {
      P0002: "Size not found",
      "55000": "Reactivate the listing before changing its sizes",
    });
  }

  updateTag(`listing:${listingId}`);
  updateTag("listings");
  return {};
}
