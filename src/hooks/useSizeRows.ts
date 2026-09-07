"use client";

import { useCallback, useState } from "react";

import type { ListingSizeRowState } from "@/lib/types";

type UseSizeRowsOptions = {
  /** Runs once the row count drops back down to one — e.g. to reset set-price
   * state that only makes sense with two or more rows. */
  onRowsExhausted?: () => void;
};

function emptyRow(key: string): ListingSizeRowState {
  return { key, size: "", size_group: null, price: "" };
}

/**
 * Add/update/remove rows for the size + price grid shared by the seller and
 * admin listing forms.
 */
export function useSizeRows(
  initialRows: ListingSizeRowState[] | (() => ListingSizeRowState[]),
  { onRowsExhausted }: UseSizeRowsOptions = {},
) {
  const [rows, setRows] = useState<ListingSizeRowState[]>(initialRows);

  const updateRow = useCallback(
    (key: string, patch: Partial<Omit<ListingSizeRowState, "key">>) => {
      setRows((prev) =>
        prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, emptyRow(crypto.randomUUID())]);
  }, []);

  const removeRow = useCallback(
    (key: string) => {
      setRows((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((row) => row.key !== key);
        if (next.length === 1) onRowsExhausted?.();
        return next;
      });
    },
    [onRowsExhausted],
  );

  /** Clear the size/group on any row the given predicate now rejects — for a
   * category change, where a previously valid pair may no longer be. */
  const clearInvalidRows = useCallback(
    (isValid: (row: ListingSizeRowState) => boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.size && row.size_group && !isValid(row)
            ? { ...row, size: "", size_group: null }
            : row,
        ),
      );
    },
    [],
  );

  return { rows, updateRow, addRow, removeRow, clearInvalidRows };
}
