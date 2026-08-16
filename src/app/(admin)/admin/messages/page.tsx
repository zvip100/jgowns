import { TableCell, TableRow } from "@/components/ui/table";

import { AdminListPage } from "../../AdminListPage";
import { FIXTURE_MESSAGES } from "../../admin-fixtures";
import {
  buildAdminListResult,
  filterByDateRange,
  parseAdminListParams,
} from "../../admin-list";
import { formatAdminDateTime } from "../../admin-url";

import { ExpandableMessage } from "./ExpandableMessage";

import type { AdminListResult } from "../../admin-list";
import type { AdminContactMessage } from "../../admin-types";

import type { Metadata } from "next";
import type { PageSearchParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Messages",
  description: "Contact form inbox.",
  robots: { index: false, follow: false },
};

type AdminMessagesPageProps = {
  searchParams: Promise<PageSearchParams>;
};

async function loadMessages(
  searchParams: Promise<PageSearchParams>,
): Promise<AdminListResult<AdminContactMessage>> {
  const params = parseAdminListParams(await searchParams);

  let filtered = FIXTURE_MESSAGES;
  if (params.query) {
    filtered = filtered.filter((m) =>
      m.email.toLowerCase().includes(params.query),
    );
  }
  filtered = filterByDateRange(filtered, params, (m) => m.created_at);

  return buildAdminListResult(filtered, params);
}

export default function AdminMessagesPage({
  searchParams,
}: AdminMessagesPageProps) {
  return (
    <AdminListPage
      basePath="/admin/messages"
      title="Messages"
      countNoun="message"
      descriptionPrefix="Read-only inbox · "
      searchPlaceholder="Search by email"
      headers={["Email", "Message", "Received"]}
      alignRight={[2]}
      emptyTitle="No messages match"
      emptyDescription="Try clearing filters or searching a different email."
      resultPromise={loadMessages(searchParams)}
      renderRow={(message) => (
        <TableRow key={message.id}>
          <TableCell className="align-top font-medium text-(--ink)">
            {message.email}
          </TableCell>
          <TableCell className="w-full min-w-64 whitespace-normal align-top">
            <ExpandableMessage message={message.message} />
          </TableCell>
          <TableCell className="align-top text-right text-(--muted-ink)">
            {formatAdminDateTime(message.created_at)}
          </TableCell>
        </TableRow>
      )}
    />
  );
}
