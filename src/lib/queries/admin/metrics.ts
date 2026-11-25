import { ADMIN_METRICS_WEEKS } from "@/lib/admin/constants";
import { formatDayLabel } from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import { fetchStats } from "./overview";

import type {
  AdminMetrics,
  AdminMetricsPoint,
  AdminMetricsSummary,
} from "@/lib/admin/types";

/**
 * Aggregate metrics for /admin/metrics. Everything comes from claim-checked
 * SQL, never hand-rolled tracking (spec §5.7); visitor analytics stay with
 * PostHog and never overlap these marketplace numbers.
 */

type MetricsSeriesRow = {
  week_start: string;
  listings_created: number;
  listings_sold: number;
  new_users: number;
  fees_collected_cents: number;
};

function toMetricsPoint(row: MetricsSeriesRow): AdminMetricsPoint {
  return {
    week: formatDayLabel(row.week_start),
    listings_created: Number(row.listings_created),
    listings_sold: Number(row.listings_sold),
    new_users: Number(row.new_users),
    fees_collected_cents: Number(row.fees_collected_cents),
  };
}

function logAndThrow(
  what: string,
  error: { message: string; code?: string },
): never {
  console.error(`[queries/admin/metrics] Failed to load ${what}`, {
    message: error.message,
    code: error.code,
  });
  throw new Error(`Failed to load ${what}`);
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = await createClient();

  const [stats, seriesResult, summaryResult] = await Promise.all([
    fetchStats(),
    supabase.rpc("admin_metrics_series", { p_weeks: ADMIN_METRICS_WEEKS }),
    supabase.rpc("admin_metrics_summary"),
  ]);

  if (seriesResult.error) logAndThrow("metrics series", seriesResult.error);
  if (summaryResult.error) logAndThrow("metrics summary", summaryResult.error);
  if (summaryResult.data === null) {
    logAndThrow("metrics summary", { message: "RPC returned no data" });
  }

  return {
    stats,
    // This project does not generate Supabase Database types, so RPC row
    // shapes must be narrowed at this boundary before their values are mapped.
    series: ((seriesResult.data ?? []) as MetricsSeriesRow[]).map(toMetricsPoint),
    summary: summaryResult.data as AdminMetricsSummary,
  };
}
