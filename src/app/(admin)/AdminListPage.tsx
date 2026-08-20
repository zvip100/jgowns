import { Suspense } from "react";

import { AdminEmptyState } from "./AdminEmptyState";
import { AdminFilterBar } from "./AdminFilterBar";
import { AdminListSkeleton } from "./AdminListSkeleton";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminPagination } from "./AdminPagination";
import { AdminResultCount } from "./AdminResultCount";
import { AdminTable } from "./AdminTable";
import { adminListHref } from "./admin-url";

import type { AdminFilterOption } from "./AdminFilterBar";
import type { AdminListResult } from "@/lib/admin/list";

import type { ReactNode } from "react";

type AdminListPageProps<T> = {
  basePath: string;
  title: string;
  countNoun: string;
  countPluralNoun?: string;
  /** Sits ahead of the count, e.g. "Read-only inbox · ". */
  descriptionPrefix?: ReactNode;
  segments?: AdminFilterOption[];
  /** Audit log only. Every other list page passes nothing and is unchanged. */
  actorFilter?: boolean;
  searchPlaceholder: string;
  headers: ReactNode[];
  alignRight?: number[];
  emptyTitle: string;
  emptyDescription: string;
  resultPromise: Promise<AdminListResult<T>>;
  /** Returns one keyed <TableRow>. */
  renderRow: (item: T) => ReactNode;
};

/**
 * The whole shape of an admin list page: header, filter bar, table, pagination.
 * The header is outside the boundary so a title paints immediately, and the two
 * things that depend on the query, the count and the body, resolve the same
 * promise from their own boundaries.
 */
export function AdminListPage<T>(props: AdminListPageProps<T>) {
  const { title, countNoun, countPluralNoun, descriptionPrefix, resultPromise } =
    props;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Admin"
        title={title}
        description={
          <>
            {descriptionPrefix}
            <AdminResultCount
              countPromise={resultPromise.then((result) => result.totalCount)}
              noun={countNoun}
              pluralNoun={countPluralNoun}
            />
          </>
        }
      />

      <Suspense fallback={<AdminListSkeleton />}>
        <AdminListBody {...props} />
      </Suspense>
    </div>
  );
}

async function AdminListBody<T>({
  basePath,
  segments,
  actorFilter,
  searchPlaceholder,
  headers,
  alignRight,
  emptyTitle,
  emptyDescription,
  resultPromise,
  renderRow,
}: AdminListPageProps<T>) {
  const { rows, totalPages, page, params, current } = await resultPromise;

  const buildHref = (overrides: Record<string, string | undefined>) =>
    adminListHref(basePath, current, overrides);

  return (
    <>
      <AdminFilterBar
        segments={segments}
        activeSegment={params.status}
        searchPlaceholder={searchPlaceholder}
        searchValue={params.searchQuery}
        dateFrom={params.from}
        dateTo={params.to}
        actorFilter={actorFilter}
        activeActor={params.actor}
        buildHref={buildHref}
      />

      <AdminTable
        headers={headers}
        alignRight={alignRight}
        isEmpty={rows.length === 0}
        empty={
          <AdminEmptyState title={emptyTitle} description={emptyDescription} />
        }
      >
        {rows.map((row) => renderRow(row))}
      </AdminTable>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        buildHref={(target) =>
          buildHref({ page: target === 1 ? undefined : String(target) })
        }
      />
    </>
  );
}
