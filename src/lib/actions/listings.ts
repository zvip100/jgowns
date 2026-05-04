"use server";

import { revalidateTag } from "next/cache";

export async function revalidateListings() {
  revalidateTag("listings", "max");
}
