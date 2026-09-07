'use client';

import { Info } from 'lucide-react';

import { SizeRowsList } from '@/components/SizeRowsList';
import { FORM_HINT_CLASS } from '@/components/form/constants';
import { FormInfoBanner } from '@/components/form/FormInfoBanner';
import { FormSection } from '@/components/form/FormSection';
import { InputGroupField } from '@/components/form/InputGroupField';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { CHECKBOX_GOLD_CLASS } from '@/lib/styles';
import { cn } from '@/lib/utils';

import type { ListingSizesController } from '@/hooks/useListingFormSubmit';
import type { SizeRowError } from '@/lib/listing-form';
import type { GownCategoryId } from '@/lib/types';

type ListingSizesFieldProps = {
  category: GownCategoryId | null;
  controller: ListingSizesController;
  /** Per-row size/price errors, indexed parallel to the rows. */
  sizeErrors: SizeRowError[];
  /** Inline error for the set/bundle price input. */
  bundlePriceError?: string;
};

export function ListingSizesField({
  category,
  controller,
  sizeErrors,
  bundlePriceError,
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

  return (
    <FormSection legend="Sizes & pricing">
      <div className="flex flex-col gap-4">
        <FormInfoBanner icon={Info} className="items-start px-3.5 py-3">
          <span className="block font-semibold">
            Have this gown in multiple sizes?
          </span>
          <span className="mt-1 block leading-relaxed">
            Add every size you have to one listing, then sell them individually
            or as a complete set.
          </span>
        </FormInfoBanner>

        <SizeRowsList
          rows={rows}
          category={category}
          showPrice={!sellOnlyAsSet}
          sizeErrors={sizeErrors}
          onUpdateRow={updateRow}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />

        {hasMultipleSizes && (
          <div className="flex flex-col gap-4 rounded-xl border border-(--line) bg-(--bg-cream)/60 p-4">
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="sell-only-as-set"
                checked={sellOnlyAsSet}
                className={CHECKBOX_GOLD_CLASS}
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
                error={bundlePriceError}
                onChange={(e) => setBundlePrice(e.target.value)}
              />
              {!sellOnlyAsSet && (
                <FieldDescription className={cn('mt-3', FORM_HINT_CLASS)}>
                  Optional: one price for the full set.
                </FieldDescription>
              )}
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
}
