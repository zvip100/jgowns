import { requireAdmin } from "@/lib/admin/guard";
import { isAdmin } from "@/lib/admin/is-admin";
import {
  adminListResult,
  endOfDayMs,
  paginateAdminList,
} from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type { AdminUser } from "@/lib/admin/types";
import type { User } from "@supabase/supabase-js";

/**
 * Users come from the Auth Admin API, not PostgREST: `auth.users` has no
 * PostgREST surface regardless of RLS, so this is the one admin domain that
 * needs the service-role client. Every export here therefore claim-checks
 * through `requireAdmin()` first, because the service client bypasses RLS.
 */

/** Auth Admin API page size. Its own paging is independent of ADMIN_PAGE_SIZE. */
const AUTH_PAGE_SIZE = 200;

/**
 * Safety stop for the fetch-all loop. listUsers offers no search, sort, or
 * filter, so search and the segment pills have to run in memory over the whole
 * set. That is fine at this marketplace's scale; past this many accounts the
 * Users page needs the `profiles` mirror table deferred in spec Phase 4.
 */
const MAX_USERS_FETCHED = 2000;

type EmptyCounts = AdminUser["listing_counts"];

function emptyCounts(): EmptyCounts {
  return { active: 0, sold: 0, pending_payment: 0, suspended: 0, removed: 0 };
}

function toAdminUser(user: User, counts: EmptyCounts): AdminUser {
  const provider = user.app_metadata?.provider;
  const phone = user.user_metadata?.phone;
  const bannedUntil = (user as { banned_until?: string | null }).banned_until;

  return {
    id: user.id,
    email: user.email ?? "",
    provider: provider === "google" ? "google" : "email",
    phone: typeof phone === "string" && phone ? phone : null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    // Supabase writes a far-future timestamp for an indefinite ban and clears
    // the field on unban, so presence alone is not enough: an elapsed ban has
    // to read as active again.
    is_banned: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now()),
    is_admin: isAdmin(user),
    listing_counts: counts,
  };
}

async function fetchAllAuthUsers(): Promise<User[]> {
  const service = createServiceClient();
  const all: User[] = [];

  for (let page = 1; all.length < MAX_USERS_FETCHED; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE,
    });

    if (error) {
      console.error("[queries/admin/users] Failed to list users", {
        message: error.message,
        page,
      });
      throw new Error("Failed to load users");
    }

    const batch = data?.users ?? [];
    all.push(...batch);
    if (batch.length < AUTH_PAGE_SIZE) break;
  }

  return all;
}

/**
 * Listing counts per user for the ids on screen. One extra query per page
 * rather than a join, because listings and auth.users live on opposite sides
 * of the PostgREST boundary.
 */
async function fetchListingCounts(
  userIds: string[],
): Promise<Map<string, EmptyCounts>> {
  const counts = new Map<string, EmptyCounts>();
  if (userIds.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("user_id, status")
    .in("user_id", userIds);

  if (error) {
    console.error("[queries/admin/users] Failed to load listing counts", {
      message: error.message,
      code: error.code,
    });
    throw new Error("Failed to load listing counts");
  }

  for (const row of data ?? []) {
    const bucket = counts.get(row.user_id) ?? emptyCounts();
    if (row.status in bucket) {
      bucket[row.status as keyof EmptyCounts] += 1;
    }
    counts.set(row.user_id, bucket);
  }

  return counts;
}

function matchesUserSegment(segment: string, user: AdminUser): boolean {
  if (segment === "banned") return user.is_banned;
  if (segment === "admin") return user.is_admin;
  if (segment === "active") return !user.is_banned;
  return true;
}

export async function getAdminUsers(
  params: AdminListParams,
): Promise<AdminListResult<AdminUser>> {
  await requireAdmin();

  const users = await fetchAllAuthUsers();

  let rows = users.map((user) => toAdminUser(user, emptyCounts()));

  rows = rows.filter((user) => matchesUserSegment(params.status, user));
  if (params.query) {
    rows = rows.filter((user) =>
      user.email.toLowerCase().includes(params.query),
    );
  }
  if (params.from || params.to) {
    const fromMs = params.from ? new Date(params.from).getTime() : -Infinity;
    const toMs = params.to ? endOfDayMs(params.to) : Infinity;
    rows = rows.filter((user) => {
      const ms = new Date(user.created_at).getTime();
      return ms >= fromMs && ms <= toMs;
    });
  }

  rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Paginate first, then count listings only for the page on screen.
  const page = paginateAdminList(rows, params);
  const counts = await fetchListingCounts(page.rows.map((user) => user.id));

  return adminListResult(
    page.rows.map((user) => ({
      ...user,
      listing_counts: counts.get(user.id) ?? emptyCounts(),
    })),
    page.totalCount,
    params,
  );
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
  await requireAdmin();

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.getUserById(id);

  if (error || !data?.user) {
    // A missing user is a 404, not a failure: the detail page calls notFound().
    return null;
  }

  const counts = await fetchListingCounts([id]);
  return toAdminUser(data.user, counts.get(id) ?? emptyCounts());
}

/**
 * id -> email for the sellers on one page of listings or payments. Uses the
 * claim-checked `admin_user_emails` RPC rather than the Auth Admin API, which
 * has no batch get-by-ids and would otherwise force a full user listing on
 * every page render.
 */
export async function resolveUserEmails(
  userIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return emails;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_emails", {
    p_ids: unique,
  });

  if (error) {
    console.error("[queries/admin/users] Failed to resolve seller emails", {
      message: error.message,
      code: error.code,
    });
    throw new Error("Failed to resolve seller emails");
  }

  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    if (row.email) emails.set(row.id, row.email);
  }

  return emails;
}
