import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookieless service-role client. Confined to two places:
 *
 * 1. Stripe-verified code paths (webhook signature verified, or a Checkout
 *    Session re-fetched from Stripe's own API) and the retention cleanup sweep,
 *    because a webhook request carries no user session and RLS correctly blocks
 *    anonymous status writes.
 * 2. The admin Users pages, via the `auth.admin` namespace, because auth.users
 *    has no PostgREST surface regardless of RLS.
 *
 * It bypasses RLS entirely, so any admin consumer must claim-check itself
 * first (see `lib/admin/guard.ts`). Everything expressible in RLS, including
 * every other admin read, stays on the publishable key.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}
