"use server";

import { runAdminAction } from "@/lib/admin/guard";
import { confirmListingPayment } from "@/lib/actions/payments";
import { adminPaymentIdSchema } from "@/lib/validations/admin/payment-schema";

import type { ServerActionErrorResult } from "@/lib/types";

/**
 * Payments are read-only apart from this one action. Refunds and fee waivers
 * are out of scope; `record_listing_payment` stays service-role only.
 */

/**
 * Rescue a listing whose fee was paid but never activated, because the webhook
 * permanently failed or both confirm paths lost the race.
 *
 * `confirmListingPayment` already does the work: it re-fetches the Session from
 * Stripe's own API, checks `payment_status`, calls the service-role RPC, and
 * revalidates both tags. Truth never comes from a stored row or a URL param.
 * It uses `revalidateTag` rather than `updateTag` because its other callers are
 * route handlers; that is correct and this action deliberately adds no second
 * invalidation around it.
 *
 * The Session id comes from a re-read of `listing_payments` inside the action,
 * never from the client, so a replayed request cannot aim the rescue at an
 * arbitrary Session.
 */
export async function adminRescuePayment(
  paymentId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminRescuePayment", async ({ supabase }) => {
    const parsed = adminPaymentIdSchema.safeParse(paymentId);
    if (!parsed.success) return { error: "Invalid payment id" };

    const { data: payment, error: paymentError } = await supabase
      .from("listing_payments")
      .select("stripe_session_id, status, listing_id")
      .eq("id", parsed.data)
      .maybeSingle();

    if (paymentError) {
      console.error("[actions/admin/payments] Failed to read payment row", {
        paymentId: parsed.data,
        message: paymentError.message,
      });
      return { error: "Something went wrong. Please try again." };
    }
    if (!payment) return { error: "Payment not found" };
    if (payment.status === "succeeded") {
      return { error: "This payment already activated its listing." };
    }

    const result = await confirmListingPayment(payment.stripe_session_id);

    if (!result.paid) {
      // Not a failure of the rescue. A Session that is genuinely unpaid is the
      // rescue correctly declining, and the copy says so.
      return {
        error:
          result.error ?? "Stripe reports this Checkout Session is not paid.",
      };
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("title")
      .eq("id", payment.listing_id)
      .maybeSingle();

    // The activation itself is already logged as payment.succeeded by the
    // payments trigger. This second row records that an admin forced it, which
    // is why payment.rescue exists as its own slug.
    const { error: logError } = await supabase.rpc("admin_log_event", {
      p_action: "payment.rescue",
      p_entity_type: "payment",
      p_entity_id: payment.listing_id,
      // Cast because supabase-js widens a selected column to unknown here; the
      // label is display-only and an empty string is the documented fallback.
      p_entity_label: (listing?.title as string | undefined) ?? "",
      p_reason: null,
    });

    if (logError) {
      console.error("[actions/admin/payments] Failed to write audit row", {
        paymentId: parsed.data,
        message: logError.message,
      });
    }

    return {};
  });
}
