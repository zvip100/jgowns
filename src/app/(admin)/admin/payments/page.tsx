import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import { parseAdminListParams } from "@/lib/admin/list";
import { getAdminPayments } from "@/lib/queries/admin/payments";

import { AdminListPage } from "../../AdminListPage";
import { AdminPendingActionButton } from "../../AdminPendingActionButton";
import { isAdminDemoMode } from "../../admin-demo";
import { demoPayments } from "../../admin-fixtures";
import {
  formatAdminDate,
  formatCents,
  stripeSessionUrl,
} from "../../admin-url";

import type { AdminListResult } from "@/lib/admin/list";
import type { AdminPaymentRow } from "@/lib/admin/types";

import type { Metadata } from "next";
import type { PageSearchParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Payments",
  description: "Listing publishing fee rows.",
  robots: { index: false, follow: false },
};

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
  { value: "expired", label: "Expired" },
];

type AdminPaymentsPageProps = {
  searchParams: Promise<PageSearchParams>;
};

async function loadPayments(
  searchParams: Promise<PageSearchParams>,
): Promise<AdminListResult<AdminPaymentRow>> {
  const params = parseAdminListParams(await searchParams);

  if (await isAdminDemoMode()) return demoPayments(params);

  return getAdminPayments(params);
}

export default function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  return (
    <AdminListPage
      basePath="/admin/payments"
      title="Payments"
      countNoun="payment row"
      segments={SEGMENTS}
      searchPlaceholder="Search by listing title"
      headers={[
        "Seller",
        "Listing",
        "Amount",
        "Status",
        "Created",
        "Paid",
        "Action",
      ]}
      alignRight={[2, 4, 5]}
      emptyTitle="No payments match"
      emptyDescription="Try clearing filters or searching a different title."
      resultPromise={loadPayments(searchParams)}
      renderRow={(payment) => (
        <TableRow key={payment.id}>
          <TableCell>
            <Link
              href={`/admin/users/${payment.user_id}`}
              className="hover:text-(--accent-deep)"
            >
              {payment.seller_email}
            </Link>
          </TableCell>
          <TableCell>
            <Link
              href={`/admin/listings/${payment.listing_id}`}
              className="font-medium text-(--ink) hover:text-(--accent-deep)"
            >
              {payment.listing_title}
            </Link>
            <p className="mt-0.5 font-mono text-[0.65rem] text-(--muted-ink)">
              <a
                href={stripeSessionUrl(payment.stripe_session_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {payment.stripe_session_id}
              </a>
            </p>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatCents(payment.amount_cents)}
          </TableCell>
          <TableCell className="capitalize">{payment.status}</TableCell>
          <TableCell className="text-right text-(--muted-ink)">
            {formatAdminDate(payment.created_at)}
          </TableCell>
          <TableCell className="text-right text-(--muted-ink)">
            {payment.paid_at ? formatAdminDate(payment.paid_at) : ADMIN_EMPTY_VALUE}
          </TableCell>
          <TableCell>
            {payment.status === "pending" ? (
              <AdminPendingActionButton
                title="Rescue payment?"
                description="Re-verifies the Checkout Session with Stripe, then activates the listing if paid."
                confirmLabel="Rescue"
                ariaLabel="Rescue payment"
                buttonLabel="Rescue"
                icon="rescue"
                size="compact"
              />
            ) : (
              <span className="text-xs text-(--muted-ink)">
                {ADMIN_EMPTY_VALUE}
              </span>
            )}
          </TableCell>
        </TableRow>
      )}
    />
  );
}
