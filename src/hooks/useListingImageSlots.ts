'use client';

import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { optimizeListingPhoto } from '@/lib/actions/images';
import { captureEvent } from '@/lib/analytics/client';
import { SELLER_EVENTS } from '@/lib/analytics/events';
import { generateBlurDataUrl, dataUrlToFile } from '@/lib/image-upload';
import { MAX_LISTING_IMAGES, type ImageSlotState } from '@/lib/types';

import type { OptimizeListingPhotoResult } from '@/lib/actions/images';

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
  };
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

  const slotsRef = useRef<ImageSlotState[]>(slots);
  slotsRef.current = slots;

  const previewsRef = useRef<(string | null)[]>([]);
  previewsRef.current = slots.map((s) => s.preview);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((p) => {
        if (p?.startsWith('blob:')) URL.revokeObjectURL(p);
      });
    };
  }, []);

  const updateSlot = (index: number, patch: Partial<ImageSlotState>) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );
  };

  const updateSlotById = (id: string, patch: Partial<ImageSlotState>) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  };

  const onFileSelected = async (index: number, file: File) => {
    const slotId = slots[index].id;

    // One attempt per selected photo, terminated exactly once below. Retrying a
    // failed photo re-enters here and counts as a new attempt (spec §5.2).
    captureEvent(SELLER_EVENTS.photoUploadStarted, {
      file_count: 1,
      total_size: file.size,
    });
    const startedAt = Date.now();

    const oldPreview = slots[index].preview;
    if (oldPreview?.startsWith('blob:')) URL.revokeObjectURL(oldPreview);

    const tempPreview = URL.createObjectURL(file);

    updateSlot(index, {
      preview: tempPreview,
      imageFile: file,
      optimizedDataUrl: null,
      optimizeError: '',
      optimizing: true,
      existingUrl: null,
    });

    const optimizeForm = new FormData();
    optimizeForm.set('image', file);

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
        total_size: file.size,
      });
    }

    // The slot was removed, or a newer file replaced it, while optimizing.
    // (Its blob preview is already revoked by whichever action superseded it.)
    const currentSlot = slotsRef.current.find((s) => s.id === slotId);
    if (!currentSlot || currentSlot.imageFile !== file) return;

    if ('dataUrl' in result) {
      URL.revokeObjectURL(tempPreview);
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

    updateSlotById(slotId, {
      optimizing: false,
      optimizeError:
        'error' in result && result.error
          ? `Failed to automatically optimize image. You can try uploading again. (${result.error.length > 140 ? `${result.error.slice(0, 137)}…` : result.error})`
          : 'Failed to automatically optimize image. You can try uploading again.',
      blurPromise: generateBlurDataUrl(file),
    });
  };

  const onClear = (index: number) => {
    const slot = slots[index];
    if (slot.preview?.startsWith('blob:')) URL.revokeObjectURL(slot.preview);

    setSlots((prev) => {
      const next = prev.filter((_, i) => i !== index);
      while (next.length < MAX_LISTING_IMAGES)
        next.push(emptySlot(crypto.randomUUID()));
      return next;
    });
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
    onFileSelected,
    onClear,
    resolveUploadFile,
  };
}
