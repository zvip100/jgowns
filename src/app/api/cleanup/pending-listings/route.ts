import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { deleteListingImages } from "@/lib/actions/images";
import { createServiceClient } from "@/lib/supabase/service";

const PENDING_LISTING_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Constant-time comparison against CLEANUP_SECRET; never authorizes an unset secret. */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CLEANUP_SECRET ?? "";
  if (!expected) return false;

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Daily sweep for listings a seller never paid for. No buyer ever saw a
 * pending_payment listing, so this hard-deletes rows (variants and payment
 * rows follow via FK cascade) and their storage images, DB delete first so a
 * mid-way failure never orphans a DB reference to a deleted image.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - PENDING_LISTING_RETENTION_MS).toISOString();

  // The pending/cutoff predicates live on the delete itself so a listing a
  // seller pays for mid-sweep (status flipped to 'active') is never hard-
  // deleted; image cleanup and the count come from the rows it actually removed.
  const { data: deleted, error: deleteError } = await supabase
    .from("listings")
    .delete()
    .eq("status", "pending_payment")
    .lt("created_at", cutoff)
    .select("id, image_urls");

  if (deleteError) {
    console.error("Pending-listing cleanup: failed to delete stale rows:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const deletedCount = deleted?.length ?? 0;
  if (deletedCount === 0) {
    return NextResponse.json({ deleted: 0 }, { status: 200 });
  }

  const imageUrls = deleted.flatMap((row) => (row.image_urls ?? []) as string[]);

  const cleanup = await deleteListingImages(imageUrls, supabase);
  if ("error" in cleanup) {
    console.warn("Pending-listing cleanup: failed to delete storage images:", cleanup.error);
  }

  console.log(`Pending-listing cleanup: deleted ${deletedCount} stale listing(s).`);
  return NextResponse.json({ deleted: deletedCount }, { status: 200 });
}
