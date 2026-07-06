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

/** Mark a single size variant sold; the listing stays active. */
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

  const { data: updated, error } = await supabase
    .from("listing_sizes")
    .update({ status: "sold" })
    .eq("id", sizeId)
    .eq("listing_id", listingId)
    .select("id");

  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Size not found" };

  updateTag(`listing:${listingId}`);
  updateTag("listings");
  return {};
}
