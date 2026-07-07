'use client';

import { Info, Plus } from 'lucide-react';

import { ListingSizeRow } from '@/components/ListingSizeRow';
import { FORM_HINT_CLASS } from '@/components/form/constants';
import { FormInfoBanner } from '@/components/form/FormInfoBanner';
import { FormSection } from '@/components/form/FormSection';
import { InputGroupField } from '@/components/form/InputGroupField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { ListingSizesController } from '@/hooks/useListingFormSubmit';
import type { GownCategoryId } from '@/lib/types';

type ListingSizesFieldProps = {
  category: GownCategoryId | null;
  controller: ListingSizesController;
};

export function ListingSizesField({
  category,
  controller,
}: ListingSizesFieldProps) {
  const {
    rows,
    updateRow,
    addRow,
    removeRow,
    sellOnlyAsSet,
    setSellOnlyAsSet,
    bundlePrice,
    setBundlePrice,
  } = controller;

  const hasMultipleSizes = rows.length > 1;
  const takenPairs = rows.flatMap((r) =>
    r.size && r.size_group ? [{ sizeGroup: r.size_group, size: r.size }] : [],
  );

  return (
    <FormSection legend="Sizes & pricing">
      <div className="flex flex-col gap-4">
        <FormInfoBanner icon={Info} className="items-start px-3.5 py-3">
          <span className="block font-semibold">
            Have this gown in multiple sizes?
          </span>
          <span className="mt-1 block leading-relaxed">
            Add every size you have. All sizes appear on a single listing —
            sold individually or as a complete set, your choice.
          </span>
        </FormInfoBanner>

        {rows.map((row, index) => (
          <ListingSizeRow
            key={row.key}
            row={row}
            index={index}
            category={category}
            disabledSizes={takenPairs.filter(
              (p) => !(p.sizeGroup === row.size_group && p.size === row.size),
            )}
            canRemove={hasMultipleSizes}
            showPrice={!sellOnlyAsSet}
            onChange={(patch) => updateRow(row.key, patch)}
            onRemove={() => removeRow(row.key)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          disabled={!category}
          className="w-fit"
        >
          <Plus data-icon="inline-start" />
          Add another size
        </Button>

        {hasMultipleSizes && (
          <div className="flex flex-col gap-4 rounded-xl border border-(--line) bg-(--bg-cream)/60 p-4">
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="sell-only-as-set"
                checked={sellOnlyAsSet}
                onCheckedChange={(checked) => setSellOnlyAsSet(checked === true)}
              />
              <Label htmlFor="sell-only-as-set" className="font-normal">
                Sell as a complete set only
              </Label>
            </div>
            <div>
              <InputGroupField
                id="bundle-price"
                label={
                  sellOnlyAsSet ? 'Complete set price' : 'Discounted set price'
                }
                required={sellOnlyAsSet}
                leading="$"
                type="number"
                inputMode="decimal"
                placeholder="1150"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
              />
              {!sellOnlyAsSet && (
                <FieldDescription className={cn('mt-3', FORM_HINT_CLASS)}>
                  Optional — one price for the full set.
                </FieldDescription>
              )}
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
}
