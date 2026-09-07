import { NextResponse, type NextRequest } from "next/server";

import { captureServerEvent } from "@/lib/analytics/server";
import { SELLER_EVENTS } from "@/lib/analytics/events";
import { postAuthPath, safeNextPath } from "@/lib/auth-redirect";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

import type { User } from "@supabase/supabase-js";

/**
 * Google returns returning users through the same exchange as brand new ones,
 * and Supabase stamps `last_sign_in_at` during it, so a first sign-in is the one
 * that lands within a moment of the account being created.
 */
const NEW_ACCOUNT_WINDOW_MS = 10_000;

function isFirstSignIn(user: User): boolean {
  if (!user.last_sign_in_at) return true;

  return (
    new Date(user.last_sign_in_at).getTime() -
      new Date(user.created_at).getTime() <
    NEW_ACCOUNT_WINDOW_MS
  );
}

/**
 * Anonymous, unstitched counts (spec §5.2): the two events cannot be read as a
 * funnel. Email/password sign-in never reaches this route, so it reports its own
 * `signin_completed` from the action.
 */
async function captureAuthCompletion(
  user: User,
  next: string | null,
): Promise<void> {
  // A recovery link finishes here too, and resetting a password is neither a
  // registration nor a sign-in.
  if (next === "/reset-password") return;

  const method = user.app_metadata.provider === "google" ? "google" : "email";
  // Email accounts only ever reach this route to confirm a signup.
  const isRegistration = method === "email" || isFirstSignIn(user);

  await captureServerEvent(
    isRegistration
      ? SELLER_EVENTS.registerCompleted
      : SELLER_EVENTS.signinCompleted,
    { method },
  );
}

function loginErrorUrl(next: string | null, reason: "auth" | "banned" = "auth"): string {
  const url = new URL("/login", SITE_URL);
  url.searchParams.set("error", reason);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(next));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error.message);
    const reason = error.code === "user_banned" ? "banned" : "auth";
    return NextResponse.redirect(loginErrorUrl(next, reason));
  }

  await captureAuthCompletion(data.user, next);

  // Recovery links carry next=/reset-password, which postAuthPath passes through
  // untouched; only the default destination is swapped for admins.
  return NextResponse.redirect(`${SITE_URL}${postAuthPath(data.user, next)}`);
}
