'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getSizeSelectGroups } from '@/lib/gown-sizes';
import type { GownCategoryId, SizeGroupSlug } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FormField } from '@/components/form/FormField';
import { FORM_CONTROL_CLASS } from '@/components/form/constants';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const sizePickerTriggerClass =
  'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input px-2.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const sizePickerPanelClass =
  'absolute z-50 mt-1 max-h-[min(18rem,55vh)] w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md';

const sizeGroupTriggerClass =
  'py-2 px-2.5 text-sm font-normal text-foreground hover:bg-muted/40 hover:no-underline [&[data-state=open]]:bg-muted/50';

const sizeOptionClass =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-input bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground';

function sizeGroupId(label: string, index: number) {
  return label ? label.toLowerCase().replace(/\s+/g, '-') : `group-${index}`;
}

type CategorySizeSelectProps = {
  category: GownCategoryId | null;
  size: string;
  sizeGroup: SizeGroupSlug | null;
  onChange: (selection: { size: string; sizeGroup: SizeGroupSlug }) => void;
};

export function CategorySizeSelect({
  category,
  size,
  sizeGroup,
  onChange,
}: CategorySizeSelectProps) {
  const groups = category ? getSizeSelectGroups(category) : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPickerOpen(false);
    setOpenGroup('');
  }, [category]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const disabled = !category;
  const placeholder = category ? 'Select size' : 'Select category first';
  const displayValue = size;

  return (
    <FormField id="size-picker" label="Size" required>
      <div ref={rootRef} className="relative">
        <button
          id="size-picker"
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          onClick={() => {
            if (!disabled) setPickerOpen((open) => !open);
          }}
          className={cn(
            sizePickerTriggerClass,
            FORM_CONTROL_CLASS,
            !displayValue && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              pickerOpen && 'rotate-180',
            )}
          />
        </button>

        {pickerOpen && category ? (
          <div className={sizePickerPanelClass} role="listbox">
            <Accordion
              type="single"
              collapsible
              value={openGroup}
              onValueChange={setOpenGroup}
              className="w-full"
            >
              {groups.map((group, index) => {
                const id = sizeGroupId(group.label, index);
                const title = group.label || 'Sizes';
                return (
                  <AccordionItem
                    key={id}
                    value={id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <AccordionTrigger className={sizeGroupTriggerClass}>
                      {title}
                    </AccordionTrigger>
                    <AccordionContent className="h-auto px-2 pt-2 pb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((o) => {
                          const isActive =
                            size === o.value && sizeGroup === o.sizeGroup;
                          return (
                            <button
                              key={`${o.sizeGroup}-${o.value}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              data-active={isActive}
                              onClick={() => {
                                onChange({
                                  size: o.value,
                                  sizeGroup: o.sizeGroup,
                                });
                                setPickerOpen(false);
                                setOpenGroup('');
                              }}
                              className={sizeOptionClass}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
