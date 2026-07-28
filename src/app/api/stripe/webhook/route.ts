import { NextResponse, type NextRequest } from "next/server";

import { confirmListingPayment } from "@/lib/actions/payments";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/service";

import type Stripe from "stripe";

/**
 * Flips a payment row to 'expired' on a failed/expired Checkout session. A DB
 * error returns 500 so Stripe retries the event (the status='pending' predicate
 * keeps the retry idempotent); returns null on success. Not exported as a server
 * action: it takes a bare session id with no way to re-verify legitimacy on its
 * own (no Stripe API round-trip, no ownership check), so it's only reachable
 * after the signature check below passes.
 */
async function expirePaymentRow(sessionId: string): Promise<NextResponse | null> {
  const { error } = await createServiceClient()
    .from("listing_payments")
    .update({ status: "expired" })
    .eq("stripe_session_id", sessionId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to mark listing payment expired:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return null;
}

/**
 * Confirms a paid Checkout session and maps the result to a webhook response:
 * an error returns 500 so Stripe retries; a non-error failure to activate is
 * logged (a paid session that never went live must not be lost silently) and
 * acknowledged. Returns null when there's nothing to send back to Stripe.
 */
async function confirmPaidSession(sessionId: string): Promise<NextResponse | null> {
  const result = await confirmListingPayment(sessionId);
  if (!result.paid) {
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    console.warn(
      `Stripe webhook: paid session ${sessionId} was not activated (no error returned).`,
    );
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (e) {
    console.error("Stripe webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // A delayed payment method leaves payment_status 'unpaid' here;
        // async_payment_succeeded finishes the job once it clears.
        if (session.payment_status === "paid") {
          const errorResponse = await confirmPaidSession(session.id);
          if (errorResponse) return errorResponse;
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const errorResponse = await confirmPaidSession(session.id);
        if (errorResponse) return errorResponse;
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const errorResponse = await expirePaymentRow(session.id);
        if (errorResponse) return errorResponse;
        break;
      }
      default:
        // Acknowledged and ignored.
        break;
    }
  } catch (e) {
    console.error("Stripe webhook processing failed:", e);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
