/**
 * Central claim check for admin access. Role lives in JWT `app_metadata.role`.
 * Used by the proxy, `(admin)` layout, and later every
 * admin server action / query.
 */
export function isAdmin(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return user?.app_metadata?.role === "admin";
}
