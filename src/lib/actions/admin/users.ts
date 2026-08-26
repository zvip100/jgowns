"use server";

import { updateTag } from "next/cache";

import { runAdminAction } from "@/lib/admin/guard";
import { deleteListingImages } from "@/lib/actions/images";
import { createServiceClient } from "@/lib/supabase/service";
import {
  BAN_DURATION,
  BAN_SWEEP_NOTE,
  BAN_SWEEP_SLUG,
  UNBAN_DURATION,
  adminUserIdSchema,
  banUserSchema,
} from "@/lib/validations/admin/user-schema";

import type { AdminActionClient } from "@/lib/admin/guard";
import type { ServerActionErrorResult } from "@/lib/types";
import type { BanUserOptions } from "@/lib/validations/admin/user-schema";

/**
 * Admin user writes. The mutations happen in GoTrue through the service client,
 * because `auth.users` has no PostgREST surface and no database trigger can see
 * them: these are the only Phase 3 actions that write their own audit row, and
 * they do it through `admin_log_event` on the operator's authenticated client,
 * or the row attributes to `system` and names nobody.
 */

const AUTH_FAILED_ERROR = "Something went wrong. Please try again.";

/**
 * A logging failure never fails the action: the mutation already happened, and
 * reporting it as an error would invite the operator to repeat it.
 */
async function logAdminEvent(
  auth: AdminActionClient,
  action: string,
  entityId: string,
  entityLabel: string,
  reason: string | null = null,
): Promise<void> {
  const { error } = await auth.supabase.rpc("admin_log_event", {
    p_action: action,
    p_entity_type: "user",
    p_entity_id: entityId,
    p_entity_label: entityLabel,
    p_reason: reason,
  });

  if (error) {
    console.error("[actions/admin/users] Failed to write audit row", {
      action,
      entityId,
      message: error.message,
    });
  }
}

/**
 * The target's email is the audit row's `entity_label`, and after a delete it is
 * unreachable, so a failed read fails the action rather than proceeding with an
 * empty label and losing that history permanently.
 */
async function readTargetEmail(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{ email: string } | { error: string }> {
  const { data, error } = await service.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    console.error("[actions/admin/users] Failed to read the target account", {
      userId,
      message: error?.message ?? "no user returned",
    });
    return { error: AUTH_FAILED_ERROR };
  }

  return { email: data.user.email ?? "" };
}

/** Cascade and sweep invalidation: the grid once, each detail page by id. */
function invalidateListings(ids: string[]): void {
  for (const id of ids) updateTag(`listing:${id}`);
  updateTag("listings");
}

/**
 * Ban, then optionally suspend the seller's live inventory. No transaction
 * spans GoTrue and Postgres, so the order carries the safety: a ban with the
 * sweep still pending is a recoverable half-state, while live listings under a
 * banned seller are the thing being prevented.
 */
export async function adminBanUser(
  userId: string,
  options?: BanUserOptions,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminBanUser", async (auth) => {
    // The whole options object goes through zod rather than being read first:
    // a replayed request can pass anything, and `options.sweepListings` on an
    // explicit null would throw out of an action that must only ever return.
    // `userId` is spread over last, so a forged one in the options is ignored.
    const parsed = banUserSchema.safeParse({ ...(options ?? {}), userId });
    if (!parsed.success) {
      const isId = parsed.error.issues[0]?.path[0] === "userId";
      return { error: isId ? "Invalid user id" : "Invalid request" };
    }

    const service = createServiceClient();

    const target = await readTargetEmail(service, parsed.data.userId);
    if ("error" in target) return { error: target.error };

    const { error: banError } = await service.auth.admin.updateUserById(
      parsed.data.userId,
      { ban_duration: BAN_DURATION },
    );

    if (banError) {
      console.error("[actions/admin/users] Ban failed", {
        userId: parsed.data.userId,
        message: banError.message,
      });
      return { error: AUTH_FAILED_ERROR };
    }

    let sweptIds: string[] = [];

    if (parsed.data.sweepListings) {
      const { data, error: sweepError } = await auth.supabase.rpc(
        "admin_suspend_seller_listings",
        {
          p_user_id: parsed.data.userId,
          p_slug: BAN_SWEEP_SLUG,
          p_note: BAN_SWEEP_NOTE,
        },
      );

      if (sweepError) {
        console.error("[actions/admin/users] Ban sweep failed", {
          userId: parsed.data.userId,
          message: sweepError.message,
        });
        // The ban stands, so this is a partial success, not a success. Saying
        // "done" here would leave live listings under a banned seller with
        // nobody aware of it.
        await logAdminEvent(auth, "user.ban", parsed.data.userId, target.email);
        return {
          error:
            "The account is banned, but their listings could not be suspended. Suspend them from the listings page.",
        };
      }

      // Cast because supabase-js types an RPC's return as the generic Json;
      // the function's signature is `returns uuid[]`, which is what bounds it.
      sweptIds = (data ?? []) as string[];
    }

    await logAdminEvent(
      auth,
      "user.ban",
      parsed.data.userId,
      target.email,
      sweptIds.length > 0
        ? `${sweptIds.length} active listing${sweptIds.length === 1 ? "" : "s"} suspended`
        : null,
    );

    // Nothing to invalidate when no listing changed.
    if (sweptIds.length > 0) invalidateListings(sweptIds);

    return {};
  });
}

/**
 * Unban restores sign-in only. Listings suspended by the ban sweep stay
 * suspended and are restored one at a time, so an operator sees each one before
 * it goes back on the market.
 */
export async function adminUnbanUser(
  userId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminUnbanUser", async (auth) => {
    const parsed = adminUserIdSchema.safeParse(userId);
    if (!parsed.success) return { error: "Invalid user id" };

    const service = createServiceClient();

    const target = await readTargetEmail(service, parsed.data);
    if ("error" in target) return { error: target.error };

    const { error } = await service.auth.admin.updateUserById(parsed.data, {
      ban_duration: UNBAN_DURATION,
    });

    if (error) {
      console.error("[actions/admin/users] Unban failed", {
        userId: parsed.data,
        message: error.message,
      });
      return { error: AUTH_FAILED_ERROR };
    }

    await logAdminEvent(auth, "user.unban", parsed.data, target.email);
    return {};
  });
}

/**
 * Hard delete. Listings, variants, payments, and wishlist items cascade off the
 * FK; gown images do not, since they are `text[]` URLs with no storage foreign
 * key. Email, listing ids, and image URLs are all read BEFORE the delete, which
 * is the only time they are reachable. The log itself survives:
 * `admin_audit_log.actor_id` is `on delete set null`.
 */
export async function adminDeleteUser(
  userId: string,
): Promise<ServerActionErrorResult> {
  return runAdminAction("adminDeleteUser", async (auth) => {
    const parsed = adminUserIdSchema.safeParse(userId);
    if (!parsed.success) return { error: "Invalid user id" };

    const service = createServiceClient();

    const target = await readTargetEmail(service, parsed.data);
    if ("error" in target) return { error: target.error };

    const { data: listings, error: listingsError } = await auth.supabase
      .from("listings")
      .select("id, image_urls")
      .eq("user_id", parsed.data);

    if (listingsError) {
      console.error("[actions/admin/users] Failed to collect listings", {
        userId: parsed.data,
        message: listingsError.message,
      });
      return { error: AUTH_FAILED_ERROR };
    }

    // Both casts are supabase-js widening a selected column, not a claim about
    // the data: `id` is uuid and `image_urls` is text[] on the table itself.
    const listingIds = (listings ?? []).map((row) => row.id as string);
    const imageUrls = (listings ?? []).flatMap(
      (row) => (row.image_urls ?? []) as string[],
    );

    const { error } = await service.auth.admin.deleteUser(parsed.data);

    if (error) {
      console.error("[actions/admin/users] Delete failed", {
        userId: parsed.data,
        message: error.message,
      });
      return { error: AUTH_FAILED_ERROR };
    }

    await logAdminEvent(
      auth,
      "user.delete",
      parsed.data,
      target.email,
      listingIds.length > 0
        ? `${listingIds.length} listing${listingIds.length === 1 ? "" : "s"} removed with the account`
        : null,
    );

    if (imageUrls.length > 0) {
      const cleanup = await deleteListingImages(imageUrls);
      if ("error" in cleanup) {
        // The account is already gone, so this cannot be retried by repeating
        // the action. Stray objects are a hygiene problem, not a failed delete.
        console.warn("[actions/admin/users] Failed to sweep deleted user images", {
          userId: parsed.data,
          error: cleanup.error,
        });
      }
    }

    if (listingIds.length > 0) invalidateListings(listingIds);

    return {};
  });
}
