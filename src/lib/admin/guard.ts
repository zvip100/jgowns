import { isAdmin } from "@/lib/admin/is-admin";
import { createClient } from "@/lib/supabase/server";

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
