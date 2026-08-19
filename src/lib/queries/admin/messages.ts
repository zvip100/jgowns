import { endOfDayMs, fetchAdminListPage } from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type { AdminContactMessage } from "@/lib/admin/types";

/**
 * Read-only contact inbox. `contact_messages` had no select policy at all
 * before Phase 2; the admin policy added there is the only way anything in the
 * app can read this table, and there is still no update or delete path.
 */
export async function getAdminMessages(
  params: AdminListParams,
): Promise<AdminListResult<AdminContactMessage>> {
  const supabase = await createClient();

  return fetchAdminListPage<AdminContactMessage>(params, async (range) => {
    let query = supabase
      .from("contact_messages")
      .select("id, email, message, created_at", { count: "exact" });

    if (params.query) query = query.ilike("email", `%${params.query}%`);
    if (params.from) {
      query = query.gte("created_at", new Date(params.from).toISOString());
    }
    if (params.to) {
      query = query.lte(
        "created_at",
        new Date(endOfDayMs(params.to)).toISOString(),
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(range.from, range.to);

    if (error) {
      console.error("[queries/admin/messages] Failed to load messages", {
        message: error.message,
        code: error.code,
      });
      throw new Error("Failed to load messages");
    }

    return { rows: (data ?? []) as AdminContactMessage[], count: count ?? 0 };
  });
}

/** Hours since the oldest message, for the overview inbox tile. */
export async function getOldestMessageAgeHours(): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_messages")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[queries/admin/messages] Failed to load oldest message", {
      message: error.message,
      code: error.code,
    });
    throw new Error("Failed to load oldest message");
  }
  if (!data) return null;

  const ms = Date.now() - new Date(data.created_at).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}
