'use client';

import { useRef, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { optimizeListingPhoto } from '@/lib/actions/images';
import { captureEvent } from '@/lib/analytics/client';
import { SELLER_EVENTS } from '@/lib/analytics/events';
import {
  exportEditedImage,
  generateBlurDataUrl,
  dataUrlToFile,
  UNREADABLE_PHOTO_ERROR,
} from '@/lib/image-upload';
import { editsEqual } from '@/components/photo-studio/photo-studio-draft';
import {
  MAX_LISTING_IMAGES,
  type EditableImage,
  type ImageSlotState,
  type PhotoEdits,
  type PhotoStudioItem,
} from '@/lib/types';

import type { OptimizeListingPhotoResult } from '@/lib/actions/images';

export const EDIT_FAILED_ERROR = "Your edits couldn't be saved. The previous version is kept.";

type UseListingImageSlotsOptions = {
  initialUrls?: string[];
  initialBlurUrls?: string[];
};

// Initial slots need deterministic ids: render-time crypto.randomUUID() marks the
// page dynamic under Cache Components (blank prerender shell) and mismatches on hydration.
function emptySlot(id: string): ImageSlotState {
  return {
    id,
    preview: null,
    imageFile: null,
    optimizedDataUrl: null,
    blurPromise: Promise.resolve(null),
    optimizing: false,
    optimizeError: '',
    existingUrl: null,
    source: null,
    edits: null,
    version: 0,
  };
}

function revokeBlob(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

/** Every object URL a slot owns: its preview and the studio source behind it. */
function slotBlobs(slot: ImageSlotState): string[] {
  return [slot.preview, slot.source?.src].filter(
    (url): url is string => Boolean(url?.startsWith('blob:')),
  );
}

/** The studio's view of the slots: filled ones, in order. */
export function slotsToStudioItems(slots: ImageSlotState[]): PhotoStudioItem[] {
  return slots.flatMap((slot): PhotoStudioItem[] => {
    if (slot.existingUrl) return [{ id: slot.id, kind: 'uploaded', url: slot.existingUrl }];
    if (slot.source && slot.edits) {
      return [{ id: slot.id, kind: 'new', image: slot.source, edits: slot.edits }];
    }
    return [];
  });
}

export function useListingImageSlots({
  initialUrls = [],
  initialBlurUrls = [],
}: UseListingImageSlotsOptions = {}) {
  const [slots, setSlots] = useState<ImageSlotState[]>(() => {
    const initial: ImageSlotState[] = initialUrls.map((url, i) => ({
      ...emptySlot(`slot-${i}`),
      preview: url,
      existingUrl: url,
      blurPromise: Promise.resolve(initialBlurUrls[i] ?? null),
    }));
    while (initial.length < MAX_LISTING_IMAGES) {
      initial.push(emptySlot(`slot-${initial.length}`));
    }
    return initial;
  });

  // No revoke on effect cleanup: Cache Components hides the route in an
  // Activity, which runs cleanups but keeps these slots, and a revoked source
  // could not be reopened in the studio. The page's unload frees them.
  const slotsRef = useRef<ImageSlotState[]>(slots);
  slotsRef.current = slots;

  const updateSlotById = (id: string, patch: Partial<ImageSlotState>) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  };

  /** The slot, only while this export is still its newest one and on screen. */
  const currentSlot = (slotId: string, version: number): ImageSlotState | undefined =>
    slotsRef.current.find((slot) => slot.id === slotId && slot.version === version);

  const processPhoto = async (
    slotId: string,
    version: number,
    image: EditableImage,
    edits: PhotoEdits,
    previous?: ImageSlotState,
  ) => {
    const startedAt = Date.now();
    const uploadFile = await exportEditedImage(image, edits);

    // Superseded by a re-edit or removed before it could upload: no attempt.
    const exportingSlot = currentSlot(slotId, version);
    if (!exportingSlot) return;

    // One attempt per new or edited photo, terminated exactly once below.
    // Retrying a failed photo goes back through the studio and counts as a new
    // attempt (spec §5.2).
    captureEvent(SELLER_EVENTS.photoUploadStarted, {
      file_count: 1,
      total_size: uploadFile?.size ?? 0,
    });

    if (!uploadFile) {
      captureEvent(SELLER_EVENTS.photoUploadFailed, {
        reason: 'unreadable_image',
        file_count: 1,
        total_size: 0,
      });
      // A re-edit falls back to the version that already exported.
      if (previous) {
        updateSlotById(slotId, {
          ...previous,
          version,
          optimizing: false,
          optimizeError: EDIT_FAILED_ERROR,
        });
        return;
      }
      slotBlobs(exportingSlot).forEach((url) => URL.revokeObjectURL(url));
      updateSlotById(slotId, {
        ...emptySlot(slotId),
        version,
        optimizeError: UNREADABLE_PHOTO_ERROR,
      });
      return;
    }

    revokeBlob(exportingSlot.preview);
    const exportedPreview = URL.createObjectURL(uploadFile);
    updateSlotById(slotId, { preview: exportedPreview, imageFile: uploadFile });

    const optimizeForm = new FormData();
    optimizeForm.set('image', uploadFile);

    // The action itself always returns, so a rejection is the request failing
    // to complete (offline, a body the host refused, a 500). Folding it into
    // the result shape keeps one terminal path: without it the attempt emits
    // no outcome and the slot spins forever.
    let result: OptimizeListingPhotoResult;
    try {
      result = await optimizeListingPhoto(optimizeForm);
    } catch (e) {
      unstable_rethrow(e);
      result = {
        error:
          e instanceof Error && e.message ? e.message : 'The upload failed.',
      };
    }

    // Captured before the staleness guard below: the attempt genuinely finished,
    // whether or not its slot is still on screen to receive the result.
    if ('dataUrl' in result) {
      captureEvent(SELLER_EVENTS.photoUploadSucceeded, {
        file_count: 1,
        duration_ms: Date.now() - startedAt,
      });
    } else {
      captureEvent(SELLER_EVENTS.photoUploadFailed, {
        reason: result.error ? result.error.slice(0, 120) : 'unknown',
        file_count: 1,
        total_size: uploadFile.size,
      });
    }

    // The slot was removed, or a newer edit replaced it, while optimizing.
    // Whichever action superseded it already revoked this preview.
    if (!currentSlot(slotId, version)) return;

    if ('dataUrl' in result) {
      URL.revokeObjectURL(exportedPreview);
      updateSlotById(slotId, {
        preview: result.dataUrl,
        optimizedDataUrl: result.dataUrl,
        optimizeError: '',
        optimizing: false,
        // The server already made one from the same buffer it optimized. Canvas
        // stays the fallback below, for the raw file an optimize failure leaves.
        blurPromise: result.blurDataUrl
          ? Promise.resolve(result.blurDataUrl)
          : generateBlurDataUrl(result.dataUrl),
      });
      return;
    }

    // The submit falls back to uploading the exported file itself.
    updateSlotById(slotId, {
      optimizing: false,
      optimizeError:
        'error' in result && result.error
          ? `Failed to automatically optimize image. You can try uploading again. (${result.error.length > 140 ? `${result.error.slice(0, 137)}…` : result.error})`
          : 'Failed to automatically optimize image. You can try uploading again.',
      blurPromise: generateBlurDataUrl(uploadFile),
    });
  };

  /**
   * Takes the studio's saved order. Untouched photos keep their slot as is, a
   * pure reorder exports nothing, and each new or edited photo is exported and
   * optimized under a fresh version.
   */
  const applyStudio = (items: PhotoStudioItem[]) => {
    const prev = slotsRef.current;
    const keptSources = new Set(
      items.flatMap((item) => (item.kind === 'new' ? [item.image.src] : [])),
    );
    const jobs: Parameters<typeof processPhoto>[] = [];

    const next = items.flatMap((item): ImageSlotState[] => {
      const existing = prev.find((slot) => slot.id === item.id);
      if (item.kind === 'uploaded') return existing ? [existing] : [];

      const isUntouched =
        existing?.source?.src === item.image.src && editsEqual(existing.edits, item.edits);
      if (existing && isUntouched) return [existing];

      const version = (existing?.version ?? 0) + 1;
      const hasExported =
        Boolean(existing?.imageFile) && existing?.source?.src === item.image.src;
      jobs.push([item.id, version, item.image, item.edits, hasExported ? existing : undefined]);
      return [
        {
          ...emptySlot(item.id),
          // An edited photo keeps its last preview under the spinner until the new one lands.
          preview: existing?.preview ?? null,
          source: item.image,
          edits: item.edits,
          version,
          optimizing: true,
        },
      ];
    });

    for (const slot of prev) {
      const survivor = next.find((candidate) => candidate.id === slot.id);
      if (!survivor) {
        slotBlobs(slot)
          .filter((url) => !keptSources.has(url))
          .forEach((url) => URL.revokeObjectURL(url));
        continue;
      }
      if (slot.source && slot.source.src !== survivor.source?.src && !keptSources.has(slot.source.src)) {
        URL.revokeObjectURL(slot.source.src);
      }
    }

    while (next.length < MAX_LISTING_IMAGES) next.push(emptySlot(crypto.randomUUID()));
    slotsRef.current = next;
    setSlots(next);
    jobs.forEach((job) => void processPhoto(...job));
  };

  const onClear = (index: number) => {
    const prev = slotsRef.current;
    const slot = prev[index];
    if (!slot) return;
    slotBlobs(slot).forEach((url) => URL.revokeObjectURL(url));

    const next = prev.filter((_, i) => i !== index);
    while (next.length < MAX_LISTING_IMAGES) next.push(emptySlot(crypto.randomUUID()));
    slotsRef.current = next;
    setSlots(next);
  };

  /** Returns the File to upload for a slot: optimized data URL → File, or raw file. */
  async function resolveUploadFile(
    slot: ImageSlotState,
  ): Promise<File | null> {
    if (slot.optimizedDataUrl) {
      return dataUrlToFile(
        slot.optimizedDataUrl,
        slot.imageFile?.name ?? 'photo.jpg',
      );
    }
    return slot.imageFile ?? null;
  }

  return {
    slots,
    applyStudio,
    onClear,
    resolveUploadFile,
  };
}
