'use client';

import { Trash2 } from 'lucide-react';

import { CategorySizeSelect } from '@/components/CategorySizeSelect';
import { InputGroupField } from '@/components/form/InputGroupField';
import { Button } from '@/components/ui/button';

import type {
  GownCategoryId,
  ListingSizeRowState,
  SizeGroupSlug,
} from '@/lib/types';

type ListingSizeRowProps = {
  row: ListingSizeRowState;
  index: number;
  category: GownCategoryId | null;
  /** Sizes chosen in other rows — disabled in this row's picker. */
  disabledSizes: readonly { sizeGroup: SizeGroupSlug; size: string }[];
  canRemove: boolean;
  /** Hidden in set-only mode, where the one set price replaces per-size prices. */
  showPrice: boolean;
  onChange: (patch: Partial<Omit<ListingSizeRowState, 'key'>>) => void;
  onRemove: () => void;
};

export function ListingSizeRow({
  row,
  index,
  category,
  disabledSizes,
  canRemove,
  showPrice,
  onChange,
  onRemove,
}: ListingSizeRowProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <CategorySizeSelect
          id={`size-picker-${index}`}
          category={category}
          size={row.size}
          sizeGroup={row.size_group}
          disabledSizes={disabledSizes}
          onChange={({ size, sizeGroup }) =>
            onChange({ size, size_group: sizeGroup })
          }
        />
      </div>
      {showPrice && (
        <div className="min-w-0 flex-1">
          <InputGroupField
            id={`size-price-${index}`}
            label="Price"
            required
            leading="$"
            type="number"
            inputMode="decimal"
            placeholder="500"
            value={row.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </div>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={
            row.size ? `Remove size ${row.size}` : `Remove size row ${index + 1}`
          }
          className="mb-1 shrink-0 text-(--muted-ink) hover:text-destructive"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
