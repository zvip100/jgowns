import type { ReactNode } from "react";

type AdminListPanelProps = {
  children: ReactNode;
  /** Rendered in place of the rows when the list has nothing in it. */
  emptyLabel?: string;
  isEmpty?: boolean;
};

/** Divided list surface used by the admin detail pages. */
export function AdminListPanel({
  children,
  emptyLabel,
  isEmpty = false,
}: AdminListPanelProps) {
  return (
    <ul className="mt-3 divide-y divide-(--line) surface-panel hairline rounded-2xl">
      {isEmpty && emptyLabel ? (
        <li className="px-4 py-3 text-sm text-(--muted-ink)">{emptyLabel}</li>
      ) : (
        children
      )}
    </ul>
  );
}
