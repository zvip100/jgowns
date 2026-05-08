"use server";

import { revalidateTag, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function revalidateListings() {
  revalidateTag("listings", "max");
}

export async function markListingSold(id: string) {
  if (!id || typeof id !== "string") {
    throw new Error("Invalid listing id");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  updateTag(`listing:${id}`);
  updateTag("listings");
}
