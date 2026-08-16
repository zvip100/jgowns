import { cache } from "react";

import { isAdmin } from "@/lib/admin/is-admin";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Current user from the session JWT, deduped per request. Verifies the token locally via
 * getClaims (no Auth-server round-trip when asymmetric JWT signing keys are enabled).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;

  const { claims } = data;
  return {
    id: claims.sub,
    email: claims.email ?? null,
    isAdmin: isAdmin(claims),
  };
});

export type SessionContact = { email: string | null; phone: string | null };

/**
 * Email + phone to prefill the new-listing form's contact fields. Phone lives in
 * user_metadata (set at registration; see MEMORY 06-15), not on auth.users.phone.
 * Reads the local JWT via getClaims — no Auth-server round-trip.
 */
export const getSessionContact = cache(
  async (): Promise<SessionContact | null> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data) return null;

    const { claims } = data;
    const rawPhone: unknown = claims.user_metadata?.phone;
    const phone = typeof rawPhone === "string" ? rawPhone : null;
    return { email: claims.email ?? null, phone };
  },
);
