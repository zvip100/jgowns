'use client';

import { Plus } from 'lucide-react';

import { ListingSizeRow } from '@/components/ListingSizeRow';
import { Button } from '@/components/ui/button';

import type { SizeRowError } from '@/lib/listing-form';
import type { GownCategoryId, ListingSizeRowState } from '@/lib/types';

type SizeRowsListProps = {
  rows: ListingSizeRowState[];
  category: GownCategoryId | null;
  /** Hidden in set-only mode, where the one set price replaces per-size prices. */
  showPrice: boolean;
  /** Per-row size/price errors, indexed parallel to the rows. */
  sizeErrors?: SizeRowError[];
  onUpdateRow: (
    key: string,
    patch: Partial<Omit<ListingSizeRowState, 'key'>>,
  ) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
};

/**
 * The size/price row grid shared by the seller and admin listing forms: one
 * `ListingSizeRow` per entry plus an "Add another size" button. Each row's
 * size picker disables the sizes already chosen by the other rows.
 */
export function SizeRowsList({
  rows,
  category,
  showPrice,
  sizeErrors,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
}: SizeRowsListProps) {
  const takenPairs = rows.flatMap((row) =>
    row.size && row.size_group
      ? [{ sizeGroup: row.size_group, size: row.size }]
      : [],
  );

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <ListingSizeRow
          key={row.key}
          row={row}
          index={index}
          category={category}
          disabledSizes={takenPairs.filter(
            (p) => !(p.sizeGroup === row.size_group && p.size === row.size),
          )}
          canRemove={rows.length > 1}
          showPrice={showPrice}
          error={sizeErrors?.[index]}
          onChange={(patch) => onUpdateRow(row.key, patch)}
          onRemove={() => onRemoveRow(row.key)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAddRow}
        disabled={!category}
        className="w-fit"
      >
        <Plus data-icon="inline-start" />
        Add another size
      </Button>
    </div>
  );
}
