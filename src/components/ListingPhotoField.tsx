'use client';

import Image from 'next/image';
import { ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { FORM_HINT_CLASS, FORM_LABEL_CLASS } from '@/components/form/constants';
import { FormInfoBanner } from '@/components/form/FormInfoBanner';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldError } from '@/components/ui/field';
import { cn } from '@/lib/utils';

import type { ImageSlotState } from '@/lib/types';

const SLOT_MICRO_TEXT_CLASS =
  'text-[0.6rem] font-semibold uppercase tracking-[0.14em] sm:text-[0.65rem]';

type ListingPhotoSlotProps = {
  index: number;
  slot: ImageSlotState;
  onFileSelected: (index: number, file: File) => void;
  onClear: (index: number) => void;
};

function ListingPhotoSlot({
  index,
  slot,
  onFileSelected,
  onClear,
}: ListingPhotoSlotProps) {
  const isRequired = index === 0;
  const preview = slot.preview;

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: (accepted: File[]) => {
        const file = accepted[0];
        if (file) onFileSelected(index, file);
      },
      accept: { 'image/*': [] },
      multiple: false,
      useFsAccessApi: false,
    });

  const isDragAccepting = isDragActive && !isDragReject;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        {...getRootProps({
          'aria-label': `Photo ${index + 1}${isRequired ? ' (required)' : ' (optional)'}`,
          className: cn(
            'group relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border outline-none transition',
            'focus-visible:ring-2 focus-visible:ring-(--focus-ring)',
            preview
              ? 'border-border bg-card shadow-sm'
              : 'border-(--line) bg-(--bg-cream) hover:-translate-y-0.5 hover:border-(--accent) hover:shadow-[0_10px_24px_rgba(106,74,39,0.12)]',
            isDragAccepting && 'border-(--accent-deep) bg-(--bg-ivory)',
            isDragReject && 'border-destructive bg-destructive/10',
          ),
        })}
      >
        <input {...getInputProps({ id: `photo-${index}` })} />

        {preview ? (
          <>
            <Image
              src={preview}
              alt={`Photo ${index + 1} preview`}
              fill
              sizes="(min-width: 640px) 192px, 33vw"
              unoptimized
              className="object-cover"
            />
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-black/55 to-transparent pb-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100',
                isDragActive && 'opacity-100',
              )}
            >
              <span className={cn(SLOT_MICRO_TEXT_CLASS, 'text-white')}>
                {isDragReject
                  ? 'Images only'
                  : isDragAccepting
                    ? 'Drop to replace'
                    : 'Replace'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onClear(index);
              }}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-2 top-2 z-20 rounded-full border border-border bg-background/90 text-foreground shadow-lg ring-1 ring-black/5 hover:bg-muted"
            >
              <X />
            </Button>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-2 rounded-[0.9rem] border border-dashed border-(--line) transition-colors group-hover:border-accent',
                isDragAccepting && 'border-(--accent-deep)',
                isDragReject && 'border-destructive',
              )}
            />
            <span
              className={cn(
                'absolute left-3 top-3 rounded-full border border-(--line) bg-background/70 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            <div className="flex flex-col items-center gap-2 px-2 text-center">
              <ImagePlus
                className={cn(
                  'size-6 shrink-0 text-(--accent-deep) transition-transform group-hover:scale-110 sm:size-7',
                  isDragReject && 'text-destructive',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  SLOT_MICRO_TEXT_CLASS,
                  isDragReject ? 'text-destructive' : 'text-foreground/80',
                )}
              >
                {isDragReject
                  ? 'Images only'
                  : isDragAccepting
                    ? 'Drop to add'
                    : 'Add photo'}
              </span>
              <span className="hidden text-sm font-light italic text-muted-foreground/80 sm:block">
                {isRequired ? '(required)' : '(optional)'}
              </span>
            </div>
          </>
        )}

        {slot.optimizing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 px-3 text-center backdrop-blur-sm">
            <Loader2
              className="size-8 shrink-0 animate-spin text-(--accent-deep)"
              aria-hidden
            />
            <span className={cn(SLOT_MICRO_TEXT_CLASS, 'text-muted-foreground')}>
              Optimizing image…
            </span>
          </div>
        )}
      </div>

      {slot.optimizeError && <FieldError>{slot.optimizeError}</FieldError>}
    </div>
  );
}

type ListingPhotoFieldProps = {
  slots: ImageSlotState[];
  onFileSelected: (index: number, file: File) => void;
  onClear: (index: number) => void;
};

export function ListingPhotoField({
  slots,
  onFileSelected,
  onClear,
}: ListingPhotoFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className={FORM_LABEL_CLASS}>Photos *</span>
      <FieldDescription className={cn('-mt-2', FORM_HINT_CLASS)}>
        One photo required (full-length front view).
      </FieldDescription>
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {slots.map((slot, i) => (
          <ListingPhotoSlot
            key={slot.id}
            index={i}
            slot={slot}
            onFileSelected={onFileSelected}
            onClear={onClear}
          />
        ))}
      </div>
      <FormInfoBanner icon={ShieldCheck}>
        Faces are automatically blurred to protect privacy.
      </FormInfoBanner>
    </div>
  );
}
