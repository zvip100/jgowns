import { isAdmin } from "@/lib/admin/is-admin";

export const DEFAULT_POST_AUTH_PATH = "/dashboard";
export const ADMIN_POST_AUTH_PATH = "/admin";

/** Shown for both the password and Google sign-in paths (Supabase's `user_banned` error). */
export const BANNED_ACCOUNT_MESSAGE =
  "Your account has been banned. Contact us for details.";

/** Keyed by the `/login?error=` reason; single source of truth for both render paths. */
export const AUTH_SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  auth: "We could not sign you in. Please try again.",
  banned: BANNED_ACCOUNT_MESSAGE,
};

/**
 * A banned account (or another pre-code failure) never reaches our OAuth callback
 * route as a `?code=`: GoTrue rejects it and redirects the browser straight back
 * with the reason in a URL fragment, which never reaches the server at all. Parsed
 * client-side once the browser has the full URL, against the same reason keys as
 * `AUTH_SIGN_IN_ERROR_MESSAGES`.
 */
export function authErrorReasonFromHash(
  hash: string,
): keyof typeof AUTH_SIGN_IN_ERROR_MESSAGES | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("error_code") === "user_banned") return "banned";
  if (params.get("error")) return "auth";
  return null;
}

const ADMIN_PATH_PATTERN = /^\/admin([/?#]|$)/;
const API_PATH_PATTERN = /^\/api([/?#]|$)/;

/**
 * Sanitize an explicitly requested post-auth target, or return null when nothing
 * usable was requested. Guards against open redirects (external/protocol-relative
 * URLs) and auth-page loops. The null case is what keeps "the user asked for
 * /dashboard" distinguishable from "the user asked for nothing" — collapsing both
 * to the default path is what made admins ignore an explicit next=/dashboard.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  if (
    next.startsWith("/login") ||
    next.startsWith("/register") ||
    API_PATH_PATTERN.test(next)
  ) {
    return null;
  }
  return next;
}

/** Same sanitizer, collapsed to a concrete path for callers that always need one. */
export function safePostAuthPath(next: string | null | undefined): string {
  return safeNextPath(next) ?? DEFAULT_POST_AUTH_PATH;
}

/**
 * Where a just-authenticated user lands. An explicit `next` always wins, since it
 * is the page they were bounced off, unless it is an admin URL they have no claim
 * for. Only the no-request default is swapped, sending admins to their own home
 * instead of the seller dashboard. The claim is read through `isAdmin`, never
 * inspected inline (spec §3).
 */
export function postAuthPath(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
  next: string | null | undefined,
): string {
  const requested = safeNextPath(next);
  const isAdminUser = isAdmin(user);
  if (requested && (isAdminUser || !ADMIN_PATH_PATTERN.test(requested))) {
    return requested;
  }
  return isAdminUser ? ADMIN_POST_AUTH_PATH : DEFAULT_POST_AUTH_PATH;
}

/** Append a requested `next` to an auth link (e.g. login ↔ register cross-links). */
export function withPostAuthPath(path: string, next: string): string {
  const requested = safeNextPath(next);
  if (!requested) return path;
  return `${path}?next=${encodeURIComponent(requested)}`;
}
