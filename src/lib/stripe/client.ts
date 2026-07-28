import "server-only";
import Stripe from "stripe";

/** Pinned so a Dashboard-side default-version change can never silently alter behavior. */
const STRIPE_API_VERSION = "2026-06-24.dahlia";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: STRIPE_API_VERSION,
  });
  return stripeClient;
}
