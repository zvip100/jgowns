import "server-only";

import { captureServerError } from "@/lib/analytics/server";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";

import type { SupabaseServer } from "@/lib/actions/auth";
import type Stripe from "stripe";

const CHECKOUT_CANCEL_ERROR =
  "Couldn't cancel the open payment. Please try again.";
const PAYMENT_COMPLETING_ERROR = "Payment is completing. Refresh and try again.";

export type RetireOpenCheckoutResult = { ok: true } | { error: string };

/**
 * The only two PaymentIntent states that mean the money is not coming. Stripe
 * returns a declined intent to `requires_payment_method` so it can be retried;
 * everything else (`processing`, `requires_action`, `requires_confirmation`,
 * `requires_capture`) means a payment is still live.
 */
const TERMINAL_INTENT_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "canceled",
]);

/**
 * Whether a Checkout Session's payment may still be settling.
 *
 * A session's own status cannot tell a failed asynchronous payment from one
 * still in flight: both sit at complete + unpaid, and Stripe documents
 * `complete` as "payment processing may still be in progress". Only the
 * PaymentIntent distinguishes them. Reading complete + unpaid as failure is how
 * a seller pays the publishing fee twice, and how a removal takes a listing
 * down while its fee can still arrive.
 *
 * Fails closed: an unreadable intent counts as settling, because charging twice
 * is worse than making a seller wait for a webhook that will free the retry
 * anyway (`async_payment_failed` and `checkout.session.expired` both retire the
 * row).
 */
export async function isCheckoutSettling(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.status !== "complete" || session.payment_status !== "unpaid") {
    return false;
  }

  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!intentId) return true;

  try {
    const intent = await getStripe().paymentIntents.retrieve(intentId);
    return !TERMINAL_INTENT_STATUSES.has(intent.status);
  } catch (e) {
    await captureServerError(
      { scope: "stripe.isCheckoutSettling.retrieveIntent" },
      e,
    );
    return true;
  }
}

/**
 * Closes every still-pending Checkout for a listing before it is retired.
 * Without this a removal leaves a payable session behind: the seller finishes
 * paying, the fee is collected, and confirmation can no longer publish anything
 * because activation only flips pending_payment to active. Refuses outright
 * while a session is already paid and waiting on the webhook.
 *
 * Shared by the seller's own Remove and the admin's take-it-down-for-good, which
 * is the point: a listing must not be retirable through a door that skips this.
 * `supabase` reads the rows under the caller's own grants (a seller sees their
 * own, an admin sees all); the status write goes through the service role
 * because `listing_payments` has no authenticated update policy.
 */
export async function retireOpenListingCheckout(
  supabase: SupabaseServer,
  listingId: string,
): Promise<RetireOpenCheckoutResult> {
  const { data: pendingPayments, error: pendingError } = await supabase
    .from("listing_payments")
    .select("stripe_session_id")
    .eq("listing_id", listingId)
    .eq("status", "pending");

  if (pendingError) return { error: pendingError.message };
  if (!pendingPayments?.length) return { ok: true };

  const stripe = getStripe();
  const service = createServiceClient();

  for (const row of pendingPayments) {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
    } catch (e) {
      await captureServerError(
        { scope: "stripe.retireOpenListingCheckout.retrieveSession" },
        e,
      );
      return { error: CHECKOUT_CANCEL_ERROR };
    }

    // Money already in, or still on its way: don't expire or retire either one.
    // Removing now takes the listing down while the fee can still land against
    // it, and activation only ever flips pending_payment to active.
    if (session.payment_status === "paid" || (await isCheckoutSettling(session))) {
      return { error: PAYMENT_COMPLETING_ERROR };
    }

    if (session.status === "open") {
      try {
        await stripe.checkout.sessions.expire(row.stripe_session_id);
      } catch (e) {
        await captureServerError(
          { scope: "stripe.retireOpenListingCheckout.expireSession" },
          e,
        );
        return { error: CHECKOUT_CANCEL_ERROR };
      }
    }

    const { error: expireError } = await service
      .from("listing_payments")
      .update({ status: "expired" })
      .eq("stripe_session_id", row.stripe_session_id)
      .eq("status", "pending");

    if (expireError) return { error: expireError.message };
  }

  return { ok: true };
}
