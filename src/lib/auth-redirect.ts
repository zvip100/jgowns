import { isAdmin } from "@/lib/admin/is-admin";

export const DEFAULT_POST_AUTH_PATH = "/dashboard";
export const ADMIN_POST_AUTH_PATH = "/admin";

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
