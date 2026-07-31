import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookieless service-role client, confined to Stripe-verified code paths
 * (webhook signature verified, or a Checkout Session re-fetched from
 * Stripe's own API) and the retention cleanup sweep — a webhook request
 * carries no user session, and RLS correctly blocks anonymous status writes.
 * Every other write in the app stays on the publishable key + RLS.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}
