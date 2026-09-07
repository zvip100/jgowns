import { ADMIN_DEMO_MODE_MESSAGE } from "@/lib/admin/constants";
import { isAdminDemoMode } from "@/lib/admin/demo";
import { isAdmin } from "@/lib/admin/is-admin";
import { createClient } from "@/lib/supabase/server";

import type { SupabaseServer } from "@/lib/actions/auth";
import type { ServerActionResult } from "@/lib/types";

/**
 * Server-side claim check for admin code paths that do NOT ride RLS.
 *
 * Reads that go through the publishable key are already bounded by the admin
 * select policies, which are the real boundary. The service-role client is not:
 * it bypasses RLS entirely, so anything built on it (the Auth Admin API behind
 * the Users pages) has to prove the caller is an admin itself. Uses `getUser()`
 * rather than `getClaims()` because this is a security boundary, matching the
 * proxy and the admin layout.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user)) {
    throw new Error("Not authorized");
  }

  return { id: user.id, email: user.email ?? null };
}

/** Rejected requests read as an ordinary action failure, never as a crash. */
export const ADMIN_NOT_AUTHORIZED_ERROR = "Not authorized";

/**
 * Demo mode substitutes fixtures into every loader, so a detail page in demo
 * mode renders fixture ids into real action forms. The buttons go inert while
 * the cookie is set, and every action refuses the request as well.
 *
 * This is a safety check, never authorization: the cookie is written from the
 * client, so an attacker simply would not send it, which costs them nothing.
 * The claim check above and RLS are what actually stop them.
 */
export const ADMIN_DEMO_MODE_ERROR = ADMIN_DEMO_MODE_MESSAGE;

/** Anything the action did not anticipate, sanitized before it leaves. */
export const ADMIN_UNEXPECTED_ERROR = "Something went wrong. Please try again.";

export type AdminActionClient = {
  supabase: SupabaseServer;
  admin: { id: string; email: string | null };
};

/**
 * The preamble every admin server action shares: claim check, demo refusal, and
 * the operator's own authenticated client.
 *
 * The client is deliberately the operator's, never the service client: the
 * audit triggers derive the actor from `auth.uid()`, so a service-role write
 * lands in the log as `system` with no actor and the log stops answering the
 * question it exists for.
 */
export async function getAdminActionClient(): Promise<
  ({ ok: true } & AdminActionClient) | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user)) {
    return { ok: false, error: ADMIN_NOT_AUTHORIZED_ERROR };
  }
  if (await isAdminDemoMode()) {
    return { ok: false, error: ADMIN_DEMO_MODE_ERROR };
  }

  return { ok: true, supabase, admin: { id: user.id, email: user.email ?? null } };
}

/**
 * The preamble plus an error boundary, which is what every admin action wraps
 * itself in.
 *
 * A server action is an independently callable endpoint, so an unexpected throw
 * would reject the promise at the client instead of returning the typed result
 * the callers expect (AGENTS §7). The guard runs INSIDE the try for that
 * reason: a refusal is an early return rather than an exception, so the refusal
 * semantics are unchanged, but a throw from `createClient()`, `getUser()`, or
 * the demo-cookie read is now sanitized like any other.
 *
 * No admin action redirects today. Adding one means `unstable_rethrow(e)` as
 * the first line of this catch, or the NEXT_REDIRECT signal is swallowed and
 * rendered as an error.
 */
export async function runAdminAction(
  scope: string,
  run: (auth: AdminActionClient) => Promise<ServerActionResult>,
): Promise<ServerActionResult> {
  try {
    const auth = await getAdminActionClient();
    if (!auth.ok) return { error: auth.error };

    return await run(auth);
  } catch (e: unknown) {
    console.error(`[actions/admin] ${scope} threw`, e);
    return { error: ADMIN_UNEXPECTED_ERROR };
  }
}
