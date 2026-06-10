'use client';

import Image from 'next/image';
import { Loader2, X } from 'lucide-react';
import { FileInputField } from '@/components/form/FileInputField';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import type { ImageSlotState } from '@/lib/types';

type ListingPhotoSlotProps = {
  index: number;
  slot: ImageSlotState;
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: (index: number) => void;
};

function ListingPhotoSlot({
  index,
  slot,
  onFileChange,
  onClear,
}: ListingPhotoSlotProps) {
  const isRequired = index === 0;
  const label =
    index === 0 ? 'Photo (required)' : `Photo ${index + 1} (optional)`;
  const hint =
    index === 0 ? 'Upload a front view showing the full gown' : undefined;

  return (
    <FileInputField
      id={`photo-${index}`}
      label={label}
      description={hint}
      required={isRequired}
      accept="image/*"
      onChange={(e) => onFileChange(index, e)}
    >
      {slot.preview && (
        <div className="mt-2">
          <div className="relative w-48">
            {slot.optimizing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 px-3 text-center backdrop-blur-sm">
                <Loader2
                  className="size-8 shrink-0 animate-spin text-(--accent-deep)"
                  aria-hidden
                />
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Optimizing image…
                </span>
              </div>
            )}
            <Image
              src={slot.preview}
              alt={`Photo ${index + 1} preview`}
              width={192}
              height={256}
              sizes="192px"
              unoptimized
              className="h-64 w-48 rounded-2xl border border-border object-cover shadow-sm"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={() => onClear(index)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -right-2 -top-2 rounded-full border border-border bg-background text-foreground shadow-lg ring-1 ring-black/5 hover:bg-muted"
            >
              <X />
            </Button>
          </div>
          {slot.optimizeError && (
            <FieldError className="mt-2 max-w-xs">{slot.optimizeError}</FieldError>
          )}
        </div>
      )}
    </FileInputField>
  );
}

type ListingPhotoFieldProps = {
  slots: ImageSlotState[];
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: (index: number) => void;
};

export function ListingPhotoField({
  slots,
  onFileChange,
  onClear,
}: ListingPhotoFieldProps) {
  return (
    <div className="flex flex-col gap-4">
      {slots.map((slot, i) => (
        <ListingPhotoSlot
          key={slot.id}
          index={i}
          slot={slot}
          onFileChange={onFileChange}
          onClear={onClear}
        />
      ))}
    </div>
  );
}
