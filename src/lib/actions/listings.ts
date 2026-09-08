"use server";

import { revalidateTag, updateTag } from "next/cache";

import { getAuthClient } from "@/lib/actions/auth";
import { retireOpenListingCheckout } from "@/lib/stripe/checkout";

import type { ServerActionErrorResult } from "@/lib/types";

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

  const retired = await retireOpenListingCheckout(supabase, id);
  if ("error" in retired) return { error: retired.error };

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
