import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import { parseAdminListParams } from "@/lib/admin/list";
import { getAdminAuditLog } from "@/lib/queries/admin/logs";

import { AdminListPage } from "../../AdminListPage";
import {
  AUDIT_ACTION_LABELS,
  describeAuditChanges,
} from "../../admin-audit-labels";
import { isAdminDemoMode } from "../../admin-demo";
import { demoAuditLog } from "../../admin-fixtures";
import { formatAdminDateTime } from "../../admin-url";
import { AuditActionPill } from "../../AuditActionPill";

import { LogChanges } from "./LogChanges";

import type { AdminListResult } from "@/lib/admin/list";
import type { AdminAuditLogEntry } from "@/lib/admin/types";

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

  if (await isAdminDemoMode()) return demoAuditLog(params);

  // The table reads "Listing suspended" but stores `listing.suspend`, so
  // searching the phrase on screen has to find the row it came from. The
  // labels live here, so the slugs they match are resolved here too.
  const labelMatchedActions = params.query
    ? Object.entries(AUDIT_ACTION_LABELS)
        .filter(([, label]: [string, string]): boolean =>
          label.toLowerCase().includes(params.query),
        )
        .map(([action]: [string, string]): string => action)
    : [];

  return getAdminAuditLog(params, labelMatchedActions);
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
