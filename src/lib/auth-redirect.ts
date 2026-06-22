export const DEFAULT_POST_AUTH_PATH = "/dashboard";

/**
 * Sanitize a post-auth `next` target to a safe app-internal path. Guards against open redirects
 * (external/protocol-relative URLs) and auth-page loops; falls back to the dashboard.
 */
export function safePostAuthPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return DEFAULT_POST_AUTH_PATH;
  if (!next.startsWith("/")) return DEFAULT_POST_AUTH_PATH;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_POST_AUTH_PATH;
  if (
    next.startsWith("/login") ||
    next.startsWith("/register") ||
    next.startsWith("/api/")
  ) {
    return DEFAULT_POST_AUTH_PATH;
  }
  return next;
}

/** Append a non-default `next` to an auth link (e.g. login ↔ register cross-links). */
export function withPostAuthPath(path: string, next: string): string {
  if (!next || next === DEFAULT_POST_AUTH_PATH) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}
