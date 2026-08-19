import { ADMIN_QUEUE_PREVIEW_SIZE } from "@/lib/admin/constants";
import { endOfDayMs, fetchAdminListPage } from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type { AdminAuditLogEntry } from "@/lib/admin/types";

/**
 * Audit log reads. The table is created in Phase 2 so this page and the
 * overview activity feed read a real table from the start; the RPCs that write
 * to it land in Phase 3, so an empty result here is the expected state until
 * then, not a failure.
 */
const AUDIT_LOG_SELECT: string =
  "id, actor_id, actor_email, action, entity_type, entity_id, entity_label, reason, before, after, created_at";

function logAndThrow(error: { message: string; code?: string }): never {
  console.error("[queries/admin/logs] Failed to load audit log", {
    message: error.message,
    code: error.code,
  });
  throw new Error("Failed to load audit log");
}

export async function getAdminAuditLog(
  params: AdminListParams,
  /**
   * Action slugs whose human label matches the search. The table stores
   * `listing.suspend` but renders "Listing suspended", and no SQL predicate can
   * see that mapping, so the caller resolves it and passes the slugs in.
   */
  labelMatchedActions: string[] = [],
): Promise<AdminListResult<AdminAuditLogEntry>> {
  const supabase = await createClient();

  return fetchAdminListPage<AdminAuditLogEntry>(params, async (range) => {
    let query = supabase
      .from("admin_audit_log")
      .select(AUDIT_LOG_SELECT, { count: "exact" });

    if (params.status !== "all") {
      query = query.eq("entity_type", params.status);
    }
    if (params.query) {
      const escapedQuery = `%${params.query}%`
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
      const quotedQuery = `"${escapedQuery}"`;
      const terms = [
        `actor_email.ilike.${quotedQuery}`,
        `action.ilike.${quotedQuery}`,
        `entity_label.ilike.${quotedQuery}`,
        ...labelMatchedActions.map((action) => `action.eq.${action}`),
      ];
      query = query.or(terms.join(","));
    }
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

    if (error) logAndThrow(error);

    return {
      rows: (data ?? []) as unknown as AdminAuditLogEntry[],
      count: count ?? 0,
    };
  });
}

/** Newest audit events, for the overview activity feed. */
export async function getRecentAuditLog(
  limit: number = ADMIN_QUEUE_PREVIEW_SIZE,
): Promise<AdminAuditLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select(AUDIT_LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) logAndThrow(error);

  return (data ?? []) as unknown as AdminAuditLogEntry[];
}

/** Audit events for one entity, newest first, for a detail page timeline. */
export async function getAuditLogForEntity(
  entityType: AdminAuditLogEntry["entity_type"],
  entityId: string,
): Promise<AdminAuditLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select(AUDIT_LOG_SELECT)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) logAndThrow(error);

  return (data ?? []) as unknown as AdminAuditLogEntry[];
}
