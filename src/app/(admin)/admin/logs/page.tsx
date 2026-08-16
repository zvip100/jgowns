import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import { AdminListPage } from "../../AdminListPage";
import { AUDIT_ACTION_LABELS, describeAuditChanges } from "../../admin-audit-labels";
import { FIXTURE_AUDIT_LOG } from "../../admin-fixtures";
import {
  buildAdminListResult,
  filterByDateRange,
  parseAdminListParams,
  sortByCreatedDesc,
} from "../../admin-list";
import { formatAdminDateTime } from "../../admin-url";
import { AuditActionPill } from "../../AuditActionPill";

import { LogChanges } from "./LogChanges";

import type { AdminListResult } from "../../admin-list";
import type { AdminAuditLogEntry } from "../../admin-types";

import type { Metadata } from "next";
import type { PageSearchParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Logs",
  description: "Admin audit log.",
  robots: { index: false, follow: false },
};

const SEGMENTS = [
  { value: "all", label: "All" },
  { value: "listing", label: "Listings" },
  { value: "user", label: "Users" },
  { value: "payment", label: "Payments" },
];

type AdminLogsPageProps = {
  searchParams: Promise<PageSearchParams>;
};

function entityHref(entry: AdminAuditLogEntry): string {
  if (entry.entity_type === "listing") {
    return `/admin/listings/${entry.entity_id}`;
  }
  if (entry.entity_type === "user") {
    return `/admin/users/${entry.entity_id}`;
  }
  return "/admin/payments";
}

async function loadLogs(
  searchParams: Promise<PageSearchParams>,
): Promise<AdminListResult<AdminAuditLogEntry>> {
  const params = parseAdminListParams(await searchParams);

  let filtered = FIXTURE_AUDIT_LOG;
  if (params.status !== "all") {
    filtered = filtered.filter((e) => e.entity_type === params.status);
  }
  if (params.query) {
    // The label as well as the stored value: the table now reads "Listing
    // suspended", so searching that phrase has to find the row it came from.
    filtered = filtered.filter(
      (e) =>
        e.actor_email.toLowerCase().includes(params.query) ||
        e.action.toLowerCase().includes(params.query) ||
        AUDIT_ACTION_LABELS[e.action].toLowerCase().includes(params.query) ||
        e.entity_label.toLowerCase().includes(params.query),
    );
  }
  filtered = filterByDateRange(filtered, params, (e) => e.created_at);

  const sorted = sortByCreatedDesc(filtered);

  return buildAdminListResult(sorted, params);
}

export default function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  return (
    <AdminListPage
      basePath="/admin/logs"
      title="Logs"
      countNoun="audit event"
      segments={SEGMENTS}
      searchPlaceholder="Search actor, action, or entity"
      headers={["Time", "Actor", "Action", "Entity", "Reason", "Change"]}
      emptyTitle="No log entries match"
      emptyDescription="Try clearing filters or searching a different actor."
      resultPromise={loadLogs(searchParams)}
      renderRow={(entry) => (
        <TableRow key={entry.id}>
          <TableCell className="align-top text-(--muted-ink)">
            {formatAdminDateTime(entry.created_at)}
          </TableCell>
          <TableCell className="align-top">{entry.actor_email}</TableCell>
          <TableCell className="align-top">
            <AuditActionPill action={entry.action} />
          </TableCell>
          <TableCell className="align-top">
            <Link
              href={entityHref(entry)}
              className="font-medium text-(--ink) hover:text-(--accent-deep)"
            >
              {entry.entity_label}
            </Link>
          </TableCell>
          <TableCell className="min-w-48 whitespace-normal align-top text-sm text-(--muted-ink)">
            {entry.reason ?? ADMIN_EMPTY_VALUE}
          </TableCell>
          <TableCell className="w-64 whitespace-normal align-top">
            <LogChanges
              changes={describeAuditChanges(entry.before, entry.after)}
              rawJson={JSON.stringify(
                { before: entry.before, after: entry.after },
                null,
                2,
              )}
            />
          </TableCell>
        </TableRow>
      )}
    />
  );
}
