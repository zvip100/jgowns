'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { UNREADABLE_PHOTO_ERROR, openEditableImage } from '@/lib/image-upload';
import { PRIMARY_CTA_PILL_CLASS } from '@/lib/styles';
import { cn } from '@/lib/utils';

import {
  activeIndexOf,
  draftOwnedSource,
  draftOwnedSources,
  emptyDraft,
  initialEdits,
  isDraftDirty,
  remainingSlots,
  studioDraftReducer,
  tooManyPhotosNote,
} from './photo-studio-draft';
import { PhotoStudioRail } from './PhotoStudioRail';
import { PhotoStudioStage } from './PhotoStudioStage';
import { PhotoStudioToolbar } from './PhotoStudioToolbar';

import type { EditableImage, PhotoEdits, PhotoStudioItem } from '@/lib/types';

type PhotoStudioDialogProps = {
  open: boolean;
  /** Called with false for Cancel, close and a confirmed discard. Save goes through `onSave`. */
  onOpenChange: (open: boolean) => void;
  initialItems: PhotoStudioItem[];
  initialIndex?: number;
  /** Photos picked before the studio opened, added as soon as it does. */
  initialFiles?: File[];
  maxItems: number;
  mode: 'listing' | 'single';
  /**
   * Receives the ordered items. The caller closes the studio itself; a
   * returned message keeps it open and shows the message instead.
   */
  onSave: (items: PhotoStudioItem[]) => void | Promise<string | void>;
};

function revoke(src: string | null): void {
  if (src) URL.revokeObjectURL(src);
}

type EmptyStageProps = {
  isSingle: boolean;
  isOpening: boolean;
  onFiles: (files: File[]) => void;
};

function EmptyStage({ isSingle, isOpening, onFiles }: EmptyStageProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (accepted: File[]) => {
      if (accepted.length > 0) onFiles(accepted);
    },
    accept: { 'image/*': [] },
    multiple: !isSingle,
    noClick: true,
    useFsAccessApi: false,
  });

  return (
    <div
      {...getRootProps({
        className: cn(
          'relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-(--bg-ivory) px-6 text-center outline-none',
          isDragActive && 'bg-(--bg-cream)',
        ),
      })}
    >
      <input {...getInputProps()} />
      {isOpening ? (
        <>
          <Loader2 className="size-7 animate-spin text-(--accent-deep)" aria-hidden />
          <p className="text-sm text-(--muted-ink)">Opening photos…</p>
        </>
      ) : (
        <>
          <ImagePlus className="size-8 text-(--accent-deep)" aria-hidden />
          <p className="font-display text-lg text-(--ink)">
            {isSingle ? 'Add a photo' : 'Add photos'}
          </p>
          <p className="max-w-xs text-sm text-(--muted-ink)">
            Drag {isSingle ? 'a photo' : 'photos'} here or choose from your device.
          </p>
          <Button type="button" onClick={open} className={cn(PRIMARY_CTA_PILL_CLASS, 'mt-1')}>
            {isSingle ? 'Choose a photo' : 'Choose photos'}
          </Button>
        </>
      )}
    </div>
  );
}

type DiscardPanelProps = { onKeep: () => void; onDiscard: () => void };

/** Lives inside the dialog rather than as a second Radix layer, so focus stays in one modal. */
function DiscardPanel({ onKeep, onDiscard }: DiscardPanelProps) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-(--bg-cream)/85 p-6 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-labelledby="photo-studio-discard-title"
        aria-describedby="photo-studio-discard-body"
        className="w-full max-w-sm rounded-2xl border border-border bg-(--bg-cream) p-6 shadow-[0_18px_40px_rgba(60,40,20,0.18)]"
      >
        <h3 id="photo-studio-discard-title" className="font-display text-lg text-(--ink)">
          Discard changes?
        </h3>
        <p id="photo-studio-discard-body" className="mt-1.5 text-sm text-(--muted-ink)">
          Photos you added and edits you made since opening will be lost.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" autoFocus onClick={onKeep} className="rounded-full">
            Keep editing
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard} className="rounded-full">
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The seller's and admin's photo editor: add, order and frame photos exactly
 * as the listing page shows them, before anything is uploaded. The draft is
 * rebuilt from `initialItems` on every open and never uploads anything itself.
 */
export function PhotoStudioDialog({
  open,
  onOpenChange,
  initialItems,
  initialIndex = 0,
  initialFiles,
  maxItems,
  mode,
  onSave,
}: PhotoStudioDialogProps) {
  const [draft, dispatch] = useReducer(studioDraftReducer, undefined, emptyDraft);
  const [isOpenedFor, setIsOpenedFor] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [openingCount, setOpeningCount] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sessionRef = useRef(0);
  const pendingRef = useRef(0);
  const importedFilesRef = useRef<File[] | null>(null);

  // Rebuilt on every open, during render, so the first frame already shows it.
  if (open && !isOpenedFor) {
    setIsOpenedFor(true);
    setIsConfirmingDiscard(false);
    setIsSaving(false);
    dispatch({ type: 'open', items: initialItems, maxItems, activeIndex: initialIndex });
  }
  if (!open && isOpenedFor) setIsOpenedFor(false);

  // Opening, closing and unmounting each make a decode still in flight stale.
  useEffect(() => {
    sessionRef.current += 1;
    pendingRef.current = 0;
    setOpeningCount(0);
    return () => {
      sessionRef.current += 1;
    };
  }, [open]);

  const isSingle = mode === 'single';
  const items = draft.items;
  const activeIndex = activeIndexOf(draft);
  const activeItem = items[activeIndex];

  /** False when the session ended before the photos opened, so nothing was added. */
  const addFiles = async (files: File[]): Promise<boolean> => {
    const session = sessionRef.current;
    const room = remainingSlots(draftRef.current) - pendingRef.current;
    const accepted = files.slice(0, Math.max(0, room));
    if (files.length > accepted.length) {
      dispatch({ type: 'note', message: tooManyPhotosNote(maxItems) });
    }
    if (accepted.length === 0) return true;

    pendingRef.current += accepted.length;
    setOpeningCount((count) => count + accepted.length);
    const opened = await Promise.all(accepted.map((file) => openEditableImage(file)));

    if (session !== sessionRef.current) {
      opened.forEach((image) => revoke(image?.src ?? null));
      return false;
    }
    pendingRef.current -= accepted.length;
    setOpeningCount((count) => count - accepted.length);

    const images = opened.filter((image): image is EditableImage => image !== null);
    if (images.length < opened.length) {
      const message =
        files.length > accepted.length
          ? `${tooManyPhotosNote(maxItems)} ${UNREADABLE_PHOTO_ERROR}`
          : UNREADABLE_PHOTO_ERROR;
      dispatch({ type: 'note', message });
    } else if (files.length === accepted.length) {
      dispatch({ type: 'note', message: '' });
    }
    dispatch({
      type: 'add',
      items: images.map((image) => ({
        id: crypto.randomUUID(),
        kind: 'new',
        image,
        edits: initialEdits(image),
      })),
    });
    return true;
  };

  // Each pick is added once. Activity reruns this when a hidden route comes back
  // with the studio still open; only a pick whose decode went stale is retried.
  useEffect(() => {
    if (!open || !initialFiles?.length || importedFilesRef.current === initialFiles) return;
    void addFiles(initialFiles).then((isAdded) => {
      if (isAdded) importedFilesRef.current = initialFiles;
    });
    // A new addFiles closure must not re-add the same pick.
  }, [open, initialFiles]);

  const removeItem = (id: string) => {
    const item = draft.items.find((candidate) => candidate.id === id);
    if (!item) return;
    revoke(draftOwnedSource(draft, item));
    dispatch({ type: 'remove', id });
  };

  const updateActive = (
    update: (edits: PhotoEdits, image: EditableImage) => PhotoEdits,
  ) => {
    if (activeItem) dispatch({ type: 'update', id: activeItem.id, update });
  };

  const requestClose = () => {
    if (isSaving) return;
    if (isDraftDirty(draft)) {
      setIsConfirmingDiscard(true);
      return;
    }
    onOpenChange(false);
  };

  const discard = () => {
    draftOwnedSources(draft).forEach(revoke);
    setIsConfirmingDiscard(false);
    onOpenChange(false);
  };

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const message = await onSave(draft.items);
      if (message) dispatch({ type: 'note', message });
    } finally {
      setIsSaving(false);
    }
  };

  const goTo = (index: number) => {
    const target = items[index];
    if (target) dispatch({ type: 'select', id: target.id });
  };

  const counter =
    items.length === 0
      ? ''
      : isSingle
        ? ''
        : `Photo ${activeIndex + 1} of ${items.length}${activeIndex === 0 ? ' · Cover' : ''}`;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (isDragging) return;
          if (isConfirmingDiscard) {
            setIsConfirmingDiscard(false);
            return;
          }
          requestClose();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          if (event.detail.originalEvent.type.startsWith('pointer') && !isConfirmingDiscard) {
            requestClose();
          }
        }}
        // Fade only: react-easy-crop measures its container on mount and gets
        // the wrong size inside a scaling modal.
        className="inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-(--bg-cream) p-0 ring-0 data-open:zoom-in-100! data-closed:zoom-out-100! sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(55rem,calc(100dvh-2rem))] sm:w-[calc(100%-4rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.4rem] sm:shadow-[0_28px_60px_rgba(20,12,5,0.32)]"
      >
        <div inert={isConfirmingDiscard} className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-(--line) px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <DialogTitle className="font-display text-lg font-medium text-(--ink)">
                {isSingle ? 'Your photo' : 'Your photos'}
              </DialogTitle>
              <DialogDescription className="text-xs tabular-nums text-(--muted-ink)">
                {openingCount > 0 ? 'Opening photos…' : counter || 'Crop and adjust before you save.'}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-white text-(--muted-ink) hover:text-(--ink)"
            >
              <X className="size-4" />
            </button>
          </header>

          {/* Locked while saving, so the export and what the seller sees cannot drift apart. */}
          <div inert={isSaving} className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {!isSingle && (
              <div className="order-last sm:order-first sm:flex">
                <PhotoStudioRail
                  items={items}
                  activeId={activeItem?.id ?? null}
                  remaining={remainingSlots(draft)}
                  note={draft.note}
                  onSelect={(id) => dispatch({ type: 'select', id })}
                  onRemove={removeItem}
                  onMove={(from, to) => dispatch({ type: 'move', from, to })}
                  onAddFiles={(files) => void addFiles(files)}
                  onDraggingChange={setIsDragging}
                />
              </div>
            )}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {activeItem ? (
                <>
                  <PhotoStudioStage
                    item={activeItem}
                    index={activeIndex}
                    count={items.length}
                    onPrev={() => goTo(activeIndex - 1)}
                    onNext={() => goTo(activeIndex + 1)}
                    onUpdate={updateActive}
                  />
                  <PhotoStudioToolbar
                    item={activeItem}
                    onUpdate={updateActive}
                    onRemove={isSingle ? () => removeItem(activeItem.id) : undefined}
                  />
                </>
              ) : (
                <EmptyStage
                  isSingle={isSingle}
                  isOpening={openingCount > 0}
                  onFiles={(files) => void addFiles(files)}
                />
              )}
              {isSingle && draft.note && (
                <p role="status" className="px-4 py-2 text-center text-xs text-(--error)">
                  {draft.note}
                </p>
              )}
            </div>
          </div>

          <footer className="flex flex-col gap-3 border-t border-(--line) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="flex items-center gap-1.5 text-xs text-(--muted-ink)">
              <ShieldCheck className="size-3.5 shrink-0 text-(--accent-deep)" aria-hidden />
              Faces are automatically blurred to protect privacy.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={isSaving}
                className="h-11 flex-1 rounded-full px-5 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={isSaving || openingCount > 0 || (isSingle && items.length === 0)}
                className={cn(PRIMARY_CTA_PILL_CLASS, 'flex-1 sm:flex-none disabled:translate-y-0')}
              >
                {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {isSaving ? 'Saving…' : isSingle ? 'Save photo' : 'Save photos'}
              </Button>
            </div>
          </footer>
        </div>

        {isConfirmingDiscard && (
          <DiscardPanel onKeep={() => setIsConfirmingDiscard(false)} onDiscard={discard} />
        )}
      </DialogContent>
    </Dialog>
  );
}
