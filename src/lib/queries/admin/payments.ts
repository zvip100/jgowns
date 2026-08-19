import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";
import { endOfDayMs, fetchAdminListPage } from "@/lib/admin/list";
import { createClient } from "@/lib/supabase/server";

import { resolveUserEmails } from "./users";

import type { AdminListParams, AdminListResult } from "@/lib/admin/list";
import type { AdminPaymentRow } from "@/lib/admin/types";
import type { ListingPayment } from "@/lib/types";

/**
 * Publishing-fee rows. Read-only: `record_listing_payment` stays service-role
 * only, so there is no admin insert, update, or delete path here. The Phase 3
 * rescue action re-verifies against Stripe rather than trusting these rows.
 */

// `!inner` so a title filter narrows the payment rows themselves rather than
// just emptying the embedded object. Widened to `string` to skip supabase-js
// literal select-string inference.
const ADMIN_PAYMENT_SELECT: string = "*, listing:listings!inner(title)";

type AdminPaymentQueryRow = ListingPayment & {
  listing: { title: string } | null;
};

function toAdminPaymentRow(
  row: AdminPaymentQueryRow,
  emails: Map<string, string>,
): AdminPaymentRow {
  const { listing, ...payment } = row;

  return {
    ...payment,
    seller_email: emails.get(row.user_id) ?? ADMIN_EMPTY_VALUE,
    listing_title: listing?.title ?? ADMIN_EMPTY_VALUE,
  };
}

export async function getAdminPayments(
  params: AdminListParams,
): Promise<AdminListResult<AdminPaymentRow>> {
  const supabase = await createClient();

  const page = await fetchAdminListPage<AdminPaymentQueryRow>(
    params,
    async (range) => {
      let query = supabase
        .from("listing_payments")
        .select(ADMIN_PAYMENT_SELECT, { count: "exact" });

      if (params.status !== "all") query = query.eq("status", params.status);

      // Search matches the listing title, which the `!inner` embed narrows the
      // payment rows by. Seller email lives in auth.users and is not joinable
      // here, so finding one seller's rows goes through their detail page; a
      // Stripe session is looked up in Stripe, which every row deep-links to.
      if (params.query) {
        query = query.ilike("listing.title", `%${params.query}%`);
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

      if (error) {
        console.error("[queries/admin/payments] Failed to load payments", {
          message: error.message,
          code: error.code,
        });
        throw new Error("Failed to load payments");
      }

      return {
        rows: (data ?? []) as unknown as AdminPaymentQueryRow[],
        count: count ?? 0,
      };
    },
  );

  const emails = await resolveUserEmails(page.rows.map((row) => row.user_id));

  return {
    ...page,
    rows: page.rows.map((row) => toAdminPaymentRow(row, emails)),
  };
}

/** Payment rows for one listing or one seller, for the detail pages. */
export async function getAdminPaymentsFor(
  scope: { listingId: string } | { userId: string },
): Promise<AdminPaymentRow[]> {
  const supabase = await createClient();

  let query = supabase.from("listing_payments").select(ADMIN_PAYMENT_SELECT);
  query =
    "listingId" in scope
      ? query.eq("listing_id", scope.listingId)
      : query.eq("user_id", scope.userId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[queries/admin/payments] Failed to load payment rows", {
      message: error.message,
      code: error.code,
      scopeKind: "listingId" in scope ? "listing" : "user",
    });
    throw new Error("Failed to load payment rows");
  }

  const rows = (data ?? []) as unknown as AdminPaymentQueryRow[];
  const emails = await resolveUserEmails(rows.map((row) => row.user_id));

  return rows.map((row) => toAdminPaymentRow(row, emails));
}
