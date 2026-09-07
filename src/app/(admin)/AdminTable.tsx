import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ReactNode } from "react";

type AdminTableProps = {
  headers: ReactNode[];
  /** Right-aligned column indices (0-based). Numbers and dates per §6.4. */
  alignRight?: number[];
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
};

export function AdminTable({
  headers,
  alignRight = [],
  children,
  empty,
  isEmpty = false,
}: AdminTableProps) {
  if (isEmpty && empty) {
    return <>{empty}</>;
  }

  return (
    // Square by design. `.hairline::after` inherits the radius, so dropping the
    // rounding here squares the gradient edge with it.
    <div className="surface-panel hairline overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headers.map((header, index) => (
              <TableHead
                key={index}
                className={
                  alignRight.includes(index)
                    ? "text-right text-(--muted-ink)"
                    : "text-(--muted-ink)"
                }
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
