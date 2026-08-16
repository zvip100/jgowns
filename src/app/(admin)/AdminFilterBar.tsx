import Link from "next/link";
import { Check } from "lucide-react";

import { FILTER_PILL_CHECK_CLASS, FILTER_PILL_CLASS } from "@/lib/styles";

import { AdminFilterForm } from "./AdminFilterForm";
import { ADMIN_SEARCH_PARAM, ADMIN_SEGMENT_PARAM } from "./admin-url";

export type AdminFilterOption = { value: string; label: string };

type AdminFilterBarProps = {
  /** Segment / status control. Empty array hides the segment row. */
  segments?: AdminFilterOption[];
  activeSegment?: string;
  searchPlaceholder: string;
  searchValue: string;
  /** Date range. Values are yyyy-mm-dd. */
  dateFrom?: string;
  dateTo?: string;
  /** Build href preserving unrelated params. */
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

/**
 * Shared list-page filter shell (§6.1). Everything writes to the URL: segment
 * pills are Links, and the search/date form is the one client leaf
 * (`AdminFilterForm`) because free-text search filters as you type.
 */
export function AdminFilterBar({
  segments = [],
  activeSegment = "all",
  searchPlaceholder,
  searchValue,
  dateFrom = "",
  dateTo = "",
  buildHref,
}: AdminFilterBarProps) {
  const activeCount =
    (activeSegment !== "all" ? 1 : 0) +
    (searchValue.trim() ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {segments.map((opt) => {
            const isActive = activeSegment === opt.value;
            return (
              <Link
                key={opt.value}
                href={buildHref({
                  [ADMIN_SEGMENT_PARAM]:
                    opt.value === "all" ? undefined : opt.value,
                  page: undefined,
                })}
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                className={FILTER_PILL_CLASS}
              >
                <Check
                  className={FILTER_PILL_CHECK_CLASS}
                  strokeWidth={3}
                  aria-hidden="true"
                />
                <span className="grid">
                  <span className="col-start-1 row-start-1">{opt.label}</span>
                  <span
                    className="invisible col-start-1 row-start-1 font-semibold"
                    aria-hidden
                  >
                    {opt.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Clear all lives inside the form so it can share the Apply row. */}
        <AdminFilterForm
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          dateFrom={dateFrom}
          dateTo={dateTo}
          activeSegment={activeSegment}
          activeCount={activeCount}
          clearHref={buildHref({
            [ADMIN_SEGMENT_PARAM]: undefined,
            [ADMIN_SEARCH_PARAM]: undefined,
            from: undefined,
            to: undefined,
            page: undefined,
          })}
        />
      </div>
    </div>
  );
}
