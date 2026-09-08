import { NextResponse, type NextRequest } from "next/server";

import { confirmListingPayment } from "@/lib/actions/payments";
import { getCurrentUser } from "@/lib/queries/auth";
import { SITE_URL } from "@/lib/site";

function confirmedUrl(params: Record<string, string>): string {
  const url = new URL("/dashboard/checkout/confirmed", SITE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Stripe redirects the buyer here after Checkout. Confirmation is a write
 * (Stripe re-verification + the activation RPC + cache invalidation), which
 * Next.js only allows from a Route Handler or Server Action, never from a
 * page's render — so this route does the work and redirects to the
 * presentational /dashboard/checkout/confirmed page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(confirmedUrl({ outcome: "not_completed" }));
  }

  const [user, result] = await Promise.all([
    getCurrentUser(),
    confirmListingPayment(sessionId),
  ]);

  if (result.paid && result.userId === user?.id) {
    return NextResponse.redirect(
      confirmedUrl({ outcome: "paid", listing: result.listingId }),
    );
  }

  // Paid but not attributable to this session (logged out, JWT expired
  // mid-checkout, or a different account): the charge succeeded and the
  // listing is active, so never route this to not_completed. Show the neutral
  // "confirming" state without leaking the listing id to a non-payer.
  if (result.paid) {
    return NextResponse.redirect(confirmedUrl({ outcome: "processing" }));
  }

  // Two ways to arrive here having paid: the charge may have succeeded while we
  // failed to verify or activate it on this request, or it is a delayed payment
  // method still settling. Both mean wait, not re-pay, and the webhook
  // (async_payment_succeeded) finishes the job either way. Only a clean unpaid
  // result with neither flag is a true no-op.
  if (!result.paid && (result.error || result.processing)) {
    return NextResponse.redirect(confirmedUrl({ outcome: "processing" }));
  }

  return NextResponse.redirect(confirmedUrl({ outcome: "not_completed" }));
}
