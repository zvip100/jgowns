import type { ServerActionErrorResult } from "@/lib/types";

/** Phase 1 inert confirm target. Real admin mutations land in Phase 3. */
export const ADMIN_BACKEND_PENDING_ERROR =
  "Backend pending. Admin writes ship in Phase 3.";

/** Appended to every pending action's confirm copy, so Phase 3 clears it once. */
export const ADMIN_BACKEND_PENDING_NOTE = "Backend pending for Phase 3.";

export async function adminActionPending(): Promise<ServerActionErrorResult> {
  return { error: ADMIN_BACKEND_PENDING_ERROR };
}
