'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

import { captureEvent } from '@/lib/analytics/client';
import { BUYER_EVENTS } from '@/lib/analytics/events';
import { blurProps, cn } from '@/lib/utils';
import { Lightbox } from '@/components/lightbox/Lightbox';

const heroNavButtonClass =
  'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70';

type ImageViewerProps = {
  listingId: string;
  imageUrls: string[];
  blurDataUrls: string[];
  title: string;
  isSold?: boolean;
};

export function ImageViewer({
  listingId,
  imageUrls,
  blurDataUrls,
  title,
  isSold = false,
}: ImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroEmblaRef, heroEmblaApi] = useEmblaCarousel({ watchDrag: imageUrls.length > 1 });
  const heroInitRef = useRef(false);
  const heroSeenRef = useRef<Set<number>>(new Set([0]));
  const lightboxSeenRef = useRef<Set<number>>(new Set());
  const lightboxStartRef = useRef(0);
  const lightboxPendingRef = useRef(false);
  const browsedCapturedRef = useRef(false);
  // Read from a ref inside the unmount cleanup, which must not re-run per photo.
  const photoCountRef = useRef(imageUrls.length);
  photoCountRef.current = imageUrls.length;

  // Reset state on mount; mark heroInitRef as needing reset on unmount
  useEffect(() => {
    setHeroIndex(0);
    return () => { heroInitRef.current = false; };
  }, []);

  // Scroll Embla to 0 on first init after each mount (not on resize-triggered reinits)
  useEffect(() => {
    if (!heroEmblaApi || heroInitRef.current) return;
    heroInitRef.current = true;
    heroEmblaApi.scrollTo(0, true);
  }, [heroEmblaApi]);

  useEffect(() => {
    if (!heroEmblaApi) return;
    const onSelect = () => {
      const index = heroEmblaApi.selectedScrollSnap();
      heroSeenRef.current.add(index);
      setHeroIndex(index);
    };
    heroEmblaApi.on('select', onSelect);
    return () => { heroEmblaApi.off('select', onSelect); };
  }, [heroEmblaApi]);

  /**
   * Inline paging is one summary event on leaving the listing, not one per
   * swipe. A single photo seen is not browsing; that visit is already
   * `listing_viewed`.
   */
  const captureBrowsedPhotos = useCallback(() => {
    if (browsedCapturedRef.current) return;
    if (heroSeenRef.current.size < 2) return;
    browsedCapturedRef.current = true;

    captureEvent(BUYER_EVENTS.listingPhotosBrowsed, {
      listing_id: listingId,
      photos_viewed: heroSeenRef.current.size,
      photos_total: photoCountRef.current,
    });
  }, [listingId]);

  /**
   * Deliberate inspection is a much stronger signal than inline paging, so it
   * is captured per open, once the count is final. The pending flag makes that
   * exactly once whether the buyer closes the viewer or leaves with it open.
   */
  const captureLightboxOpen = useCallback(() => {
    if (!lightboxPendingRef.current) return;
    lightboxPendingRef.current = false;

    captureEvent(BUYER_EVENTS.lightboxOpened, {
      listing_id: listingId,
      start_index: lightboxStartRef.current,
      photos_seen: lightboxSeenRef.current.size,
      photos_total: photoCountRef.current,
    });
  }, [listingId]);

  /**
   * Both events summarize a visit, so they flush on the way out. An unmount
   * only covers a client-side navigation: a hard navigation, a closed tab, or a
   * discarded page tears the document down without ever unmounting, which is
   * why `pagehide` is the other half. Each capture is guarded, so whichever
   * fires first wins and the second is a no-op.
   */
  useEffect(() => {
    const flush = () => {
      captureLightboxOpen();
      captureBrowsedPhotos();
    };
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    // `visibilitychange` is the one that still leaves time to send: by
    // `pagehide` the document is already going away and a freshly queued event
    // can miss its flush. Both are registered because a discarded or frozen
    // page can skip either one.
    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [captureLightboxOpen, captureBrowsedPhotos]);

  const openAt = (i: number) => {
    setStartIndex(i);
    lightboxStartRef.current = i;
    lightboxSeenRef.current = new Set();
    lightboxPendingRef.current = true;
    setOpen(true);
  };

  const trackLightboxIndex = useCallback((index: number) => {
    lightboxSeenRef.current.add(index);
  }, []);

  const handleLightboxOpenChange = (next: boolean) => {
    if (!next) captureLightboxOpen();
    setOpen(next);
  };

  return (
    <>
      <div className="relative aspect-3/4 w-full">
        <button
          type="button"
          ref={heroEmblaRef}
          onClick={() => openAt(heroIndex)}
          aria-label="Open image viewer"
          className="absolute inset-0 cursor-zoom-in overflow-hidden rounded-[1.7rem] bg-[#efe7dc]"
        >
          <div className="flex h-full">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative h-full min-w-full shrink-0">
                <Image
                  src={url}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 56vw"
                  className="object-cover"
                  priority={i === 0}
                  {...blurProps(blurDataUrls[i])}
                />
              </div>
            ))}
          </div>
          {isSold && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-(--ink)/35 via-(--ink)/15 to-transparent"
              />
              <div
                role="status"
                aria-label="This gown has been sold"
                className="pointer-events-none absolute -left-16 top-10 w-64 -rotate-45 border-y border-white/20 bg-(--sold) py-2.5 text-center text-sm font-semibold uppercase tracking-[0.5em] text-white shadow-[0_18px_36px_rgba(120,20,40,0.4)]"
              >
                Sold
              </div>
            </>
          )}
          {imageUrls.length > 1 && (
            <div
              aria-hidden
              className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[0.65rem] font-semibold text-white backdrop-blur-sm"
            >
              {heroIndex + 1} / {imageUrls.length}
            </div>
          )}
        </button>

        {imageUrls.length > 1 && heroIndex > 0 && (
          <button
            type="button"
            onClick={() => heroEmblaApi?.scrollTo(heroIndex - 1)}
            aria-label="Previous photo"
            className={cn(heroNavButtonClass, 'left-3')}
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {imageUrls.length > 1 && heroIndex < imageUrls.length - 1 && (
          <button
            type="button"
            onClick={() => heroEmblaApi?.scrollTo(heroIndex + 1)}
            aria-label="Next photo"
            className={cn(heroNavButtonClass, 'right-3')}
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      <Lightbox
        open={open}
        onOpenChange={handleLightboxOpenChange}
        imageUrls={imageUrls}
        blurDataUrls={blurDataUrls}
        title={title}
        startIndex={startIndex}
        onActiveIndexChange={trackLightboxIndex}
      />
    </>
  );
}
