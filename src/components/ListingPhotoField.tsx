'use client';

import { useState } from 'react';
import Image from 'next/image';
import { GripVertical, ImagePlus, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useSortable } from '@dnd-kit/react/sortable';

import { FORM_HINT_CLASS, FORM_LABEL_CLASS } from '@/components/form/constants';
import { FormInfoBanner } from '@/components/form/FormInfoBanner';
import { PhotoSortProvider } from '@/components/photo-studio/PhotoSortProvider';
import { PhotoStudioDialog } from '@/components/photo-studio/PhotoStudioDialog';
import { moveItem } from '@/components/photo-studio/photo-studio-draft';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldError } from '@/components/ui/field';
import { slotsToStudioItems } from '@/hooks/useListingImageSlots';
import { MAX_LISTING_IMAGES } from '@/lib/types';
import { NOTICE_PANEL_SECONDARY_ACTION_CLASS } from '@/lib/styles';
import { cn } from '@/lib/utils';

import type { ImageSlotState, PhotoStudioItem } from '@/lib/types';

const SLOT_MICRO_TEXT_CLASS =
  'text-[0.6rem] font-semibold uppercase tracking-[0.14em] sm:text-[0.65rem]';

const SLOT_CARD_CLASS =
  'group relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border outline-none transition focus-visible:ring-2 focus-visible:ring-(--focus-ring)';

const EMPTY_SLOT_CLASS =
  'cursor-pointer border-(--line) bg-(--bg-cream) hover:-translate-y-0.5 hover:border-(--accent) hover:shadow-[0_10px_24px_rgba(106,74,39,0.12)]';

function isFilled(slot: ImageSlotState): boolean {
  return Boolean(slot.existingUrl || slot.source);
}

/** Picking or dropping photos opens the studio with them already added. */
function usePhotoDrop(onFiles: (files: File[]) => void) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: (accepted: File[]) => {
      if (accepted.length > 0) onFiles(accepted);
    },
    accept: { 'image/*': [] },
    multiple: true,
    useFsAccessApi: false,
  });
  return { getRootProps, getInputProps, isDragReject, isDragAccepting: isDragActive && !isDragReject };
}

type AddPhotosZoneProps = {
  onFiles: (files: File[]) => void;
};

/** The empty field: one wide drop zone for the first photos. */
function AddPhotosZone({ onFiles }: AddPhotosZoneProps) {
  const { getRootProps, getInputProps, isDragAccepting, isDragReject } = usePhotoDrop(onFiles);

  return (
    <div
      {...getRootProps({
        role: 'button',
        'aria-label': 'Add photos',
        className: cn(
          'group relative flex flex-col items-center justify-center gap-3 rounded-[1.2rem] border border-(--line) bg-(--bg-cream) px-4 py-8 text-center outline-none transition hover:border-(--accent) hover:shadow-[0_10px_24px_rgba(106,74,39,0.1)] focus-visible:ring-2 focus-visible:ring-(--focus-ring) sm:min-h-56',
          isDragAccepting && 'border-(--accent-deep) bg-(--bg-ivory)',
          isDragReject && 'border-destructive bg-destructive/10',
        ),
      })}
    >
      <input {...getInputProps()} />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-2 rounded-[0.95rem] border border-dashed border-(--line) transition-colors group-hover:border-accent',
          isDragAccepting && 'border-(--accent-deep)',
          isDragReject && 'border-destructive',
        )}
      />
      <span className="flex size-13 items-center justify-center rounded-full bg-accent/12 text-(--accent-deep)">
        <ImagePlus className={cn('size-6', isDragReject && 'text-destructive')} aria-hidden />
      </span>
      <span className={cn('font-display text-xl font-medium', isDragReject ? 'text-destructive' : 'text-(--ink)')}>
        {isDragReject ? (
          'Images only'
        ) : isDragAccepting ? (
          'Drop to add'
        ) : (
          <>
            <span className="hidden sm:inline">Drag photos here</span>
            <span className="sm:hidden">Add your photos</span>
          </>
        )}
      </span>
      <span className="-mt-1.5 text-sm text-(--muted-ink)">
        Up to {MAX_LISTING_IMAGES}. The first one is your cover.
      </span>
      <span
        className={cn(
          NOTICE_PANEL_SECONDARY_ACTION_CLASS,
          'mt-0 w-auto gap-1.5 px-1 py-1.5 group-hover:text-[#2f241b]',
        )}
      >
        <Plus className="size-3.5" aria-hidden />
        Choose photos
      </span>
    </div>
  );
}

type AddPhotosTileProps = {
  label: string;
  hint?: string;
  number?: number;
  onFiles: (files: File[]) => void;
};

/** An empty slot beside photos already added. */
function AddPhotosTile({ label, hint, number, onFiles }: AddPhotosTileProps) {
  const { getRootProps, getInputProps, isDragAccepting, isDragReject } = usePhotoDrop(onFiles);

  return (
    <div
      {...getRootProps({
        role: 'button',
        'aria-label': label,
        className: cn(
          SLOT_CARD_CLASS,
          EMPTY_SLOT_CLASS,
          isDragAccepting && 'border-(--accent-deep) bg-(--bg-ivory)',
          isDragReject && 'border-destructive bg-destructive/10',
        ),
      })}
    >
      <input {...getInputProps()} />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-2 rounded-[0.9rem] border border-dashed border-(--line) transition-colors group-hover:border-accent',
          isDragAccepting && 'border-(--accent-deep)',
          isDragReject && 'border-destructive',
        )}
      />
      {number !== undefined && (
        <span className="absolute left-3 top-3 rounded-full border border-(--line) bg-background/70 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {number}
        </span>
      )}
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
          {isDragReject ? 'Images only' : isDragAccepting ? 'Drop to add' : label}
        </span>
        {hint && (
          <span className="hidden text-sm font-light italic text-muted-foreground/80 sm:block">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

type FilledPhotoSlotProps = {
  index: number;
  slot: ImageSlotState;
  onEdit?: () => void;
  onClear: () => void;
};

/**
 * Sortable in place. A new photo also opens the studio on click; a published
 * one can only move or go, since the studio can't edit it.
 */
function FilledPhotoSlot({ index, slot, onEdit, onClear }: FilledPhotoSlotProps) {
  const { ref, handleRef, isDragSource } = useSortable({ id: slot.id, index });

  return (
    <div ref={ref} className={cn('flex flex-col gap-1.5', isDragSource && 'z-10 opacity-80 **:cursor-grabbing')}>
      <div className="relative">
        <button
          ref={handleRef}
          type="button"
          onClick={onEdit}
          aria-label={`${onEdit ? 'Edit' : 'Move'} photo ${index + 1}${index === 0 ? ', cover' : ''}`}
          className={cn(
            SLOT_CARD_CLASS,
            'touch-manipulation select-none border-border bg-card shadow-sm active:cursor-grabbing',
            onEdit ? 'cursor-pointer' : 'cursor-grab',
          )}
        >
          {slot.preview && (
            <Image
              src={slot.preview}
              alt={`Photo ${index + 1} preview`}
              fill
              sizes="(min-width: 640px) 192px, 33vw"
              unoptimized
              draggable={false}
              className="pointer-events-none object-cover"
            />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-black/55 to-transparent pb-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className={cn(SLOT_MICRO_TEXT_CLASS, 'text-white')}>
              {onEdit ? 'Edit' : 'Drag to move'}
            </span>
          </span>
          {slot.optimizing && (
            <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 px-3 text-center backdrop-blur-sm">
              <Loader2
                className="size-8 shrink-0 animate-spin text-(--accent-deep)"
                aria-hidden
              />
              <span className={cn(SLOT_MICRO_TEXT_CLASS, 'text-muted-foreground')}>
                Optimizing image…
              </span>
            </span>
          )}
        </button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={onClear}
          aria-label={`Remove photo ${index + 1}`}
          className="absolute right-2 top-2 z-20 rounded-full border border-border bg-background/90 text-foreground shadow-lg ring-1 ring-black/5 hover:bg-muted"
        >
          <X />
        </Button>
      </div>
      {slot.optimizeError && <FieldError>{slot.optimizeError}</FieldError>}
    </div>
  );
}

type StudioState = { open: boolean; index: number; files?: File[] };

type ListingPhotoFieldProps = {
  slots: ImageSlotState[];
  onSave: (items: PhotoStudioItem[]) => void;
  onClear: (index: number) => void;
};

/**
 * The form's summary of its photos. Adds and edits happen in the photo
 * studio; this grid shows the result, the optimizing state and per-photo
 * errors, and reorders or removes photos in place.
 */
export function ListingPhotoField({ slots, onSave, onClear }: ListingPhotoFieldProps) {
  const [studio, setStudio] = useState<StudioState>({ open: false, index: 0 });
  const filled = slots.filter(isFilled);
  const empty = slots.filter((slot) => !isFilled(slot));
  const errors = empty.filter((slot) => slot.optimizeError);

  const openWithFiles = (files: File[]) =>
    setStudio({ open: true, index: filled.length, files });

  return (
    <div className="flex flex-col gap-3">
      <span className={FORM_LABEL_CLASS}>Photos *</span>
      <FieldDescription className={cn('-mt-2', FORM_HINT_CLASS)}>
        One photo required (full-length front view).
      </FieldDescription>
      {filled.length === 0 ? (
        <AddPhotosZone onFiles={openWithFiles} />
      ) : (
        <PhotoSortProvider
          onMove={(from, to) => onSave(moveItem(slotsToStudioItems(slots), from, to))}
        >
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {filled.map((slot, index) => (
              <FilledPhotoSlot
                key={slot.id}
                index={index}
                slot={slot}
                onEdit={slot.existingUrl ? undefined : () => setStudio({ open: true, index })}
                onClear={() => onClear(slots.indexOf(slot))}
              />
            ))}
            {empty.map((slot, i) => (
              <AddPhotosTile
                key={slot.id}
                label="Add photo"
                hint="(optional)"
                number={filled.length + i + 1}
                onFiles={openWithFiles}
              />
            ))}
          </div>
        </PhotoSortProvider>
      )}
      {filled.length > 1 && (
        <p className="-mt-1 flex items-center gap-1.5 text-xs text-(--muted-ink)">
          <GripVertical className="size-3.5 shrink-0" aria-hidden />
          Drag to reorder. The first photo is your cover.
        </p>
      )}
      {errors.map((slot) => (
        <FieldError key={slot.id}>{slot.optimizeError}</FieldError>
      ))}
      <FormInfoBanner icon={ShieldCheck}>
        Faces are automatically blurred to protect privacy.
      </FormInfoBanner>
      <PhotoStudioDialog
        open={studio.open}
        onOpenChange={(open) => setStudio((prev) => ({ ...prev, open, files: undefined }))}
        initialItems={slotsToStudioItems(slots)}
        initialIndex={studio.index}
        initialFiles={studio.files}
        maxItems={MAX_LISTING_IMAGES}
        mode="listing"
        onSave={(items) => {
          onSave(items);
          setStudio({ open: false, index: 0 });
        }}
      />
    </div>
  );
}
