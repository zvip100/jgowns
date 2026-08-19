import { cookies } from "next/headers";

import { ADMIN_DEMO_COOKIE } from "@/lib/admin/constants";

/**
 * TEMPORARY, pre-production. See the cookie's comment in `lib/admin/constants`
 * for the full removal checklist.
 *
 * A cookie rather than a search param so the choice survives clicking into a
 * listing, user, or payment: a `?demo=1` would have to be threaded onto every
 * link in the admin area. It is a display preference, not a boundary. Demo mode
 * only substitutes fixtures, and /admin is already claim-gated, so nothing here
 * widens what anyone can reach.
 */
export async function isAdminDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_DEMO_COOKIE)?.value === "1";
}
