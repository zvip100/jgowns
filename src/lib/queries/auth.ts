import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * Current user from the session JWT, deduped per request. Verifies the token locally via
 * getClaims (no Auth-server round-trip when asymmetric JWT signing keys are enabled).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;

  const { claims } = data;
  return { id: claims.sub, email: claims.email ?? null };
});
