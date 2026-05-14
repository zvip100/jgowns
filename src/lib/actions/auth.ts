"use server";

import { createClient } from "@/lib/supabase/server";

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function getAuthClient(): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: SupabaseServer; user: { id: string } }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "Not authenticated" };
  return { ok: true, supabase, user };
}
