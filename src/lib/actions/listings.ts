"use server";

import { revalidateTag, updateTag } from "next/cache";

import { getAuthClient } from "@/lib/actions/auth";

import type { ServerActionErrorResult } from "@/lib/types";

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

export async function removeListing(
  id: string,
): Promise<ServerActionErrorResult> {
  if (!id || typeof id !== "string") return { error: "Invalid listing id" };

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: updated, error } = await supabase
    .from("listings")
    .update({ status: "removed" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Listing not found" };

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
  const { supabase } = auth;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("status")
    .eq("id", listingId)
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
