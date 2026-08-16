import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import { AdminListPage } from "../../AdminListPage";
import { FIXTURE_USERS } from "../../admin-fixtures";
import {
  buildAdminListResult,
  filterByDateRange,
  parseAdminListParams,
} from "../../admin-list";
import { formatAdminDate } from "../../admin-url";

import type { AdminListResult } from "../../admin-list";
import type { AdminUser } from "../../admin-types";

import type { Metadata } from "next";
import type { PageSearchParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Users",
  description: "Accounts and sellers.",
  robots: { index: false, follow: false },
};

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
  { value: "admin", label: "Admins" },
];

type AdminUsersPageProps = {
  searchParams: Promise<PageSearchParams>;
};

async function loadUsers(
  searchParams: Promise<PageSearchParams>,
): Promise<AdminListResult<AdminUser>> {
  const params = parseAdminListParams(await searchParams);

  let filtered = FIXTURE_USERS;
  if (params.status === "banned") filtered = filtered.filter((u) => u.is_banned);
  else if (params.status === "admin")
    filtered = filtered.filter((u) => u.is_admin);
  else if (params.status === "active")
    filtered = filtered.filter((u) => !u.is_banned);
  if (params.query) {
    filtered = filtered.filter((u) =>
      u.email.toLowerCase().includes(params.query),
    );
  }
  filtered = filterByDateRange(filtered, params, (u) => u.created_at);

  return buildAdminListResult(filtered, params);
}

export default function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  return (
    <AdminListPage
      basePath="/admin/users"
      title="Users"
      countNoun="user"
      segments={SEGMENTS}
      searchPlaceholder="Search by email"
      headers={[
        "Email",
        "Provider",
        "Phone",
        "Listings",
        "Joined",
        "Last sign-in",
        "State",
      ]}
      alignRight={[3, 4, 5]}
      emptyTitle="No users match"
      emptyDescription="Try clearing filters or searching a different email."
      resultPromise={loadUsers(searchParams)}
      renderRow={(user) => {
        const listingTotal = Object.values(user.listing_counts).reduce(
          (a, b) => a + b,
          0,
        );

        return (
          <TableRow key={user.id}>
            <TableCell>
              <Link
                href={`/admin/users/${user.id}`}
                className="font-medium text-(--ink) hover:text-(--accent-deep)"
              >
                {user.email}
              </Link>
              {user.is_admin && (
                <span className="ml-2 text-[0.65rem] font-semibold uppercase tracking-wide text-(--accent-deep)">
                  Admin
                </span>
              )}
            </TableCell>
            <TableCell className="capitalize text-(--muted-ink)">
              {user.provider}
            </TableCell>
            <TableCell className="text-(--muted-ink)">
              {user.phone ?? ADMIN_EMPTY_VALUE}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {listingTotal}
            </TableCell>
            <TableCell className="text-right text-(--muted-ink)">
              {formatAdminDate(user.created_at)}
            </TableCell>
            <TableCell className="text-right text-(--muted-ink)">
              {user.last_sign_in_at
                ? formatAdminDate(user.last_sign_in_at)
                : ADMIN_EMPTY_VALUE}
            </TableCell>
            <TableCell>
              {user.is_banned ? (
                <span className="text-sm font-medium text-[#8a3a3a]">
                  Banned
                </span>
              ) : (
                <span className="text-sm text-[#2d7a4f]">Active</span>
              )}
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}
