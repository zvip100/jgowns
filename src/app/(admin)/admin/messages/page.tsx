import { TableCell, TableRow } from "@/components/ui/table";

import { parseAdminListParams } from "@/lib/admin/list";
import { getAdminMessages } from "@/lib/queries/admin/messages";

import { AdminListPage } from "../../AdminListPage";
import { isAdminDemoMode } from "../../admin-demo";
import { demoMessages } from "../../admin-fixtures";
import { formatAdminDateTime } from "../../admin-url";

import { ExpandableMessage } from "./ExpandableMessage";

import type { AdminListResult } from "@/lib/admin/list";
import type { AdminContactMessage } from "@/lib/admin/types";

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

  if (await isAdminDemoMode()) return demoMessages(params);

  return getAdminMessages(params);
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
