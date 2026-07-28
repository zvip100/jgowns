"use server";

import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthClient } from "@/lib/actions/auth";
import { getListingFeeCents, isListingFeeActive } from "@/lib/listing-fee";
import { getSessionContact } from "@/lib/queries/auth";
import { SITE_URL } from "@/lib/site";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";

import type { ServerActionErrorResult } from "@/lib/types";
import type Stripe from "stripe";

/**
 * Fixed once at implementation time (Stripe's Dashboard tagging convention
 * wants a stable per-flow label, not a fresh one per session).
 */
const CHECKOUT_INTEGRATION_IDENTIFIER = "jgowns-listing-fee-wknxpdrq";

const NOT_PENDING_ERROR: ServerActionErrorResult = {
  error: "This listing doesn't need a payment.",
};

/**
 * Checkout could not be started, but the listing is committed and still
 * pending, so the seller loses nothing by retrying. Returned rather than
 * redirected: the dashboard button is already on the page it would send them
 * to. createListing redirects on this instead, to get them off the new-listing
 * form before they resubmit it.
 */
const CHECKOUT_UNAVAILABLE_ERROR: ServerActionErrorResult = {
  error: "Your listing is saved. Please retry payment.",
};

/**
 * Mint (or resume) the Checkout session for a listing's publishing fee.
 * Independently callable endpoint: re-verifies auth/ownership/status itself,
 * so it's safe both as the dashboard's "Complete Payment" form action and as
 * a direct in-process call from createListing right after the listing commits.
 */
export async function createListingCheckout(
  listingId: string,
): Promise<ServerActionErrorResult> {
  if (!listingId || typeof listingId !== "string") {
    return { error: "Invalid listing id" };
  }

  const auth = await getAuthClient();
  if (!auth.ok) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", listingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listingError) return { error: listingError.message };
  if (!listing) return { error: "Listing not found" };
  if (listing.status !== "pending_payment") return NOT_PENDING_ERROR;

  if (!isListingFeeActive()) {
    // Suspended or fee 0/unset: publish for free instead of minting a session.
    // The status=pending_payment predicate keeps this safe as an
    // independently-callable endpoint — it can only ever promote a pending
    // listing, never a sold/removed one.
    const { data: updated, error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .eq("id", listingId)
      .eq("user_id", user.id)
      .eq("status", "pending_payment")
      .select("id");

    if (error) return { error: error.message };
    if (!updated?.length) return NOT_PENDING_ERROR;

    updateTag("listings");
    updateTag(`listing:${listingId}`);
    redirect("/dashboard");
  }

  // Guard against a double charge. If this listing already has a pending
  // payment, re-verify its session with Stripe before minting a new one:
  //  - already paid  -> activate it and show the paid confirmation, no charge.
  //  - state unknown -> don't risk a second charge; send them to wait it out.
  //  - cleanly unpaid (abandoned/expired) -> fall through and mint fresh.
  const { data: priorPayment } = await supabase
    .from("listing_payments")
    .select("stripe_session_id")
    .eq("listing_id", listingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorPayment) {
    const prior = await confirmListingPayment(priorPayment.stripe_session_id);
    if (prior.paid) {
      redirect(`/dashboard/checkout/confirmed?outcome=paid&listing=${listingId}`);
    }
    if (prior.error) {
      redirect("/dashboard/checkout/confirmed?outcome=processing");
    }
  }

  const feeCents = getListingFeeCents();
  const contact = await getSessionContact();

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: feeCents,
            product_data: { name: "JGowns listing fee" },
          },
          quantity: 1,
        },
      ],
      client_reference_id: listingId,
      metadata: { listing_id: listingId, user_id: user.id },
      customer_email: contact?.email ?? undefined,
      success_url: `${SITE_URL}/dashboard/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/dashboard/checkout/canceled?listing=${listingId}`,
      integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
    });
  } catch (e) {
    // The listing already committed before this ran (or already sat pending);
    // never delete the seller's work over a Checkout-creation failure. Leave
    // it pending with a working retry button.
    console.error("Failed to create Stripe Checkout session:", e);
    return CHECKOUT_UNAVAILABLE_ERROR;
  }

  if (!session.url) {
    console.error("Stripe Checkout session was created without a URL", {
      listingId,
      sessionId: session.id,
    });
    return CHECKOUT_UNAVAILABLE_ERROR;
  }

  const { error: paymentError } = await supabase
    .from("listing_payments")
    .insert({
      listing_id: listingId,
      user_id: user.id,
      stripe_session_id: session.id,
      amount_cents: feeCents,
    });

  if (paymentError) {
    console.error("Failed to record listing payment row:", paymentError.message);
    return CHECKOUT_UNAVAILABLE_ERROR;
  }

  redirect(session.url);
}

export type ConfirmListingPaymentResult =
  | { paid: true; listingId: string; userId: string }
  | { paid: false; error?: string };

/**
 * Shared idempotent confirmation core, called from both the webhook route
 * and the checkout-success route (§6): truth always comes from re-fetching
 * the session from Stripe's own API, never from a webhook payload or URL
 * param alone. Callers are Route Handlers (not Server Actions or a Server
 * Component render), so cache invalidation here uses revalidateTag rather
 * than updateTag, which Next.js only permits from within a Server Action.
 */
export async function confirmListingPayment(
  sessionId: string,
): Promise<ConfirmListingPaymentResult> {
  if (!sessionId || typeof sessionId !== "string") {
    return { paid: false, error: "Invalid session id" };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.error("Failed to retrieve Stripe Checkout session:", e);
    return { paid: false, error: "Could not verify payment." };
  }

  const listingId = session.metadata?.listing_id;
  const userId = session.metadata?.user_id;
  if (session.payment_status !== "paid" || !listingId || !userId) {
    return { paid: false };
  }

  const { error } = await createServiceClient().rpc("record_listing_payment", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("Failed to record listing payment:", error.message);
    return { paid: false, error: "Could not activate listing." };
  }

  revalidateTag("listings", "max");
  revalidateTag(`listing:${listingId}`, "max");

  return { paid: true, listingId, userId };
}
