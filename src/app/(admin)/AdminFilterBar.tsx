import { AdminActorFilter } from "./AdminActorFilter";
import { AdminFilterForm } from "./AdminFilterForm";
import { AdminFilterPill } from "./AdminFilterPill";
import {
  ADMIN_ACTOR_PARAM,
  ADMIN_SEARCH_PARAM,
  ADMIN_SEGMENT_PARAM,
} from "./admin-url";

export type AdminFilterOption = { value: string; label: string };

type AdminFilterBarProps = {
  /** Segment / status control. Empty array hides the segment group. */
  segments?: AdminFilterOption[];
  activeSegment?: string;
  searchPlaceholder: string;
  searchValue: string;
  /** Date range. Values are yyyy-mm-dd. */
  dateFrom?: string;
  dateTo?: string;
  /** Audit log only: adds the actor axis to the facet row. */
  actorFilter?: boolean;
  activeActor?: string;
  /** Build href preserving unrelated params. */
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

/**
 * Shared list-page filter shell (§6.1). Everything writes to the URL: facet
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
  actorFilter = false,
  activeActor = "all",
  buildHref,
}: AdminFilterBarProps) {
  const activeCount =
    (activeSegment !== "all" ? 1 : 0) +
    (searchValue.trim() ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (actorFilter && activeActor !== "all" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {(segments.length > 0 || actorFilter) && (
        /* Two axes, one line where they fit. Groups are nested so a wrap keeps
           each axis whole instead of breaking mid-axis. */
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {segments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {segments.map((opt) => (
                <AdminFilterPill
                  key={opt.value}
                  href={buildHref({
                    [ADMIN_SEGMENT_PARAM]:
                      opt.value === "all" ? undefined : opt.value,
                    page: undefined,
                  })}
                  isActive={activeSegment === opt.value}
                  label={opt.label}
                />
              ))}
            </div>
          )}
          {segments.length > 0 && actorFilter && (
            /* From md only, which is where the two groups are measured to share
               a line (317px + 301px + gaps against 720px of content). Below it
               they wrap onto their own lines and a rule would strand as a tick
               at the end of the first one. */
            <span
              className="hidden h-5 w-px bg-(--line) md:block"
              aria-hidden
            />
          )}
          {actorFilter && (
            <AdminActorFilter active={activeActor} buildHref={buildHref} />
          )}
        </div>
      )}

      {/* Clear all lives inside the form so it can share the Apply row. */}
      <AdminFilterForm
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
        dateFrom={dateFrom}
        dateTo={dateTo}
        activeSegment={activeSegment}
        activeActor={activeActor}
        activeCount={activeCount}
        clearHref={buildHref({
          [ADMIN_SEGMENT_PARAM]: undefined,
          [ADMIN_SEARCH_PARAM]: undefined,
          [ADMIN_ACTOR_PARAM]: undefined,
          from: undefined,
          to: undefined,
          page: undefined,
        })}
      />
    </div>
  );
}
