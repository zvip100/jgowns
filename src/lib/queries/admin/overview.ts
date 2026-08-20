import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
  ADMIN_STUCK_PAYMENT_SEGMENT,
} from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import { getAdminListings } from "./listings";
import { getRecentAuditLog } from "./logs";

import type { AdminListParams } from "@/lib/admin/list";
import type {
  AdminListing,
  AdminOverview,
  AdminOverviewStats,
  AdminQueue,
} from "@/lib/admin/types";

/**
 * Cross-entity aggregates for /admin. Lives here rather than in the entity
 * modules so the tile counts have exactly one owner (spec §7).
 */

function queueParams(segment: string): AdminListParams {
  return {
    status: segment,
    searchQuery: "",
    query: "",
    actor: "all",
    from: "",
    to: "",
    page: 1,
  };
}

export async function fetchStats(): Promise<AdminOverviewStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview_stats");

  if (error) {
    console.error("[queries/admin/overview] Failed to load overview stats", {
      message: error.message,
      code: error.code,
    });
    throw new Error("Failed to load overview stats");
  }

  if (data === null) {
    console.error("[queries/admin/overview] Failed to load overview stats", {
      message: "RPC returned no data",
    });
    throw new Error("Failed to load overview stats");
  }

  // This project does not generate Supabase Database types, so the JSON RPC
  // result must be narrowed to its SQL-owned contract at this boundary.
  return data as AdminOverviewStats;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  // One timestamp for the whole page: the four age queues and the stat tiles
  // must agree on where "this week" ends, and four separate `new Date()` calls
  // could straddle a boundary.
  const asOf = new Date().toISOString();

  const [stats, newThisWeek, staleActives, offMarket, stuckPending, recentActivity] =
    await Promise.all([
      fetchStats(),
      getAdminListings(queueParams(ADMIN_NEW_WEEK_SEGMENT), asOf),
      getAdminListings(queueParams(ADMIN_STALE_ACTIVE_SEGMENT), asOf),
      getAdminListings(queueParams(ADMIN_OFF_MARKET_STATUS), asOf),
      getAdminListings(queueParams(ADMIN_STUCK_PAYMENT_SEGMENT), asOf),
      getRecentAuditLog(),
    ]);

  const toQueue = (result: {
    rows: AdminListing[];
    totalCount: number;
  }): AdminQueue => ({ count: result.totalCount, rows: result.rows });

  return {
    stats,
    asOf,
    newThisWeek: toQueue(newThisWeek),
    staleActives: toQueue(staleActives),
    offMarket: toQueue(offMarket),
    stuckPending: toQueue(stuckPending),
    recentActivity,
  };
}
