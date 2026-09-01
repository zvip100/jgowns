'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus, X } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { blurProps, cn } from '@/lib/utils';

import { LightboxToolbar } from './LightboxToolbar';

import type { ReactNode } from 'react';

export const MAX_ZOOM = 4;

/** One press of the zoom buttons. Wheel and pinch stay continuous. */
const ZOOM_STEP = 0.5;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

/**
 * `overlay` is the buyer treatment: a full-bleed black takeover with a
 * thumbnail rail. `inspector` is the admin one: a contained frame on a warm ink
 * scrim, with the listing title and a photo counter in the header and a toolbar
 * in the footer, so the viewer reads as part of the admin rather than as a
 * different application.
 */
export type LightboxVariant = 'overlay' | 'inspector';

/**
 * Control vocabularies this component owns. The stage-edge chevron belongs to
 * the black overlay and the pills to the cream inspector frame, so neither can
 * be borrowed from a caller's file-private constants.
 */
const CONTROL_CLASS = {
  overlayArrow:
    'absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-black/55',
  pill: 'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-[#e0cfb6] bg-white/70 px-2.5 text-xs font-semibold text-(--muted-ink) transition hover:bg-white hover:text-(--ink) disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/70 disabled:hover:text-(--muted-ink)',
  level:
    'inline-flex h-8 min-w-15 items-center justify-center rounded-full border border-[#b58d5f]/70 gold-gradient px-2.5 text-xs font-semibold tabular-nums text-white',
} as const;

const SCRIM_CLASS: Record<LightboxVariant, string> = {
  overlay:
    'flex items-center justify-center h-dvh w-dvw max-w-none sm:max-w-none translate-x-0 translate-y-0 inset-0 rounded-none border-0 p-0 bg-black/80',
  // The scrim is --ink at 68%, not a literal warm brown: one token, one place
  // to change it. Ring cleared because a full-viewport scrim has no edge.
  inspector:
    'flex items-center justify-center h-dvh w-dvw max-w-none sm:max-w-none translate-x-0 translate-y-0 inset-0 rounded-none border-0 ring-0 p-0 bg-(--ink)/68',
};

type LightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrls: string[];
  blurDataUrls: string[];
  title: string;
  startIndex: number;
  variant?: LightboxVariant;
};

export function Lightbox({
  open,
  onOpenChange,
  imageUrls,
  blurDataUrls,
  title,
  startIndex,
  variant = 'overlay',
}: LightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={SCRIM_CLASS[variant]}
      >
        <DialogTitle className="sr-only">{title}: photo viewer</DialogTitle>

        <LightboxContent
          imageUrls={imageUrls}
          blurDataUrls={blurDataUrls}
          title={title}
          startIndex={startIndex}
          variant={variant}
        />
      </DialogContent>
    </Dialog>
  );
}

type LightboxContentProps = {
  imageUrls: string[];
  blurDataUrls: string[];
  title: string;
  startIndex: number;
  variant: LightboxVariant;
};

/**
 * Interactive viewer area (carousel + zoom/pan + controls). Radix only mounts a
 * DialogContent's children while the dialog is open, so this mounts fresh on
 * every open — letting useState/useEmblaCarousel initialize at `startIndex`
 * with no sync effects.
 */
function LightboxContent({
  imageUrls,
  blurDataUrls,
  title,
  startIndex,
  variant,
}: LightboxContentProps) {
  const [active, setActive] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchDistRef = useRef<number | null>(null);
  const touchPanRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex });

  const hasMultiple = imageUrls.length > 1;
  const isFirst = active === 0;
  const isLast = active === imageUrls.length - 1;

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setActive(emblaApi.selectedScrollSnap());
      resetView();
    };
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index > imageUrls.length - 1) return;
      setActive(index);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      emblaApi?.scrollTo(index);
    },
    [emblaApi, imageUrls.length],
  );

  // Esc already closes through Radix; stepping with the arrow keys is the piece
  // neither surface had.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasMultiple) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(active - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(active + 1);
    }
  };

  const clampPan = (x: number, y: number, z: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const maxX = (el.offsetWidth * (z - 1)) / 2;
    const maxY = (el.offsetHeight * (z - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y, moved: false };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    setPan(clampPan(dragRef.current.startPanX + dx, dragRef.current.startPanY + dy, zoom));
  };

  const handleMouseUp = () => {
    const moved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    setIsDragging(false);
    if (!moved) setZoom((z) => (z === 1 ? 2 : z === 2 ? 3 : 1));
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.005));
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistRef.current = Math.hypot(dx, dy);
      touchPanRef.current = null;
    } else if (e.touches.length === 1 && zoom > 1) {
      touchPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      if (touchDistRef.current === null) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - touchDistRef.current;
      touchDistRef.current = dist;
      setZoom((z) => clampZoom(z + delta * 0.01));
    } else if (e.touches.length === 1 && touchPanRef.current) {
      const dx = e.touches[0].clientX - touchPanRef.current.x;
      const dy = e.touches[0].clientY - touchPanRef.current.y;
      setPan(clampPan(touchPanRef.current.panX + dx, touchPanRef.current.panY + dy, zoom));
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
    touchPanRef.current = null;
  };

  /**
   * The zoom/pan handlers live on this surface alone, never on an ancestor that
   * also holds controls: click-to-cycle fires on any mouse-up without a drag, so
   * an arrow button sitting inside it would zoom the photo as well as move it.
   * Every control also stops propagation, which is the second half of the same
   * guarantee.
   */
  const stage = (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: isDragging ? 'grabbing' : zoom < 3 ? 'zoom-in' : 'zoom-out' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={emblaRef}
        className="h-full overflow-hidden"
        style={{ pointerEvents: zoom > 1 ? 'none' : undefined }}
      >
        <div className="flex h-full">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative h-full min-w-full overflow-hidden">
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.2s ease',
                }}
              >
                <Image
                  src={url}
                  alt={`${title} photo ${i + 1}`}
                  fill
                  sizes={
                    variant === 'inspector'
                      ? '(max-width: 640px) 100vw, 900px'
                      : '(max-width: 640px) 100vw, 675px'
                  }
                  className="object-contain"
                  priority={i === startIndex}
                  loading={i === startIndex ? undefined : 'eager'}
                  {...blurProps(blurDataUrls[i])}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const zoomControls: ReactNode = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= 1}
        onMouseUp={stopPointer}
        onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
        className={CONTROL_CLASS.pill}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className={CONTROL_CLASS.level} aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onMouseUp={stopPointer}
        onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
        className={CONTROL_CLASS.pill}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Fit photo to the frame"
        disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
        onMouseUp={stopPointer}
        onClick={resetView}
        className={CONTROL_CLASS.pill}
      >
        <Maximize className="size-3.5" aria-hidden />
        Fit
      </button>
    </div>
  );

  if (variant === 'inspector') {
    return (
      <div
        onKeyDown={handleKeyDown}
        className="flex h-[min(88vh,60rem)] w-[min(92vw,78rem)] flex-col overflow-hidden rounded-2xl border border-(--line) bg-(--bg-cream) shadow-[0_18px_40px_rgba(49,38,29,0.34)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-(--line) px-4 py-3">
          <p className="truncate text-sm font-semibold text-(--ink)">{title}</p>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-(--muted-ink)">
              Photo {active + 1} of {imageUrls.length}
            </span>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className={CONTROL_CLASS.pill}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </DialogClose>
          </div>
        </header>

        {/* The dark ground is what makes a missed face blur visible. */}
        <div className="relative flex-1 bg-(--ink)">{stage}</div>

        <LightboxToolbar
          left={
            hasMultiple ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous photo"
                  disabled={isFirst}
                  onMouseUp={stopPointer}
                  onClick={() => goTo(active - 1)}
                  className={CONTROL_CLASS.pill}
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  disabled={isLast}
                  onMouseUp={stopPointer}
                  onClick={() => goTo(active + 1)}
                  className={CONTROL_CLASS.pill}
                >
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : null
          }
          right={zoomControls}
        />
      </div>
    );
  }

  // The close button sits inside the keydown surface rather than beside it:
  // Radix moves initial focus to the first tabbable child of DialogContent, and
  // a close button outside this div would swallow the arrow keys until the
  // operator tabbed inward.
  return (
    <div className="flex items-center gap-5" onKeyDown={handleKeyDown}>
      <DialogClose asChild>
        <button
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </DialogClose>

      {/* Left thumbnail strip, sits flush against carousel */}
      {hasMultiple && (
        <div className="hidden w-20 shrink-0 flex-col items-center justify-center gap-4 sm:flex">
          {imageUrls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`View photo ${i + 1}`}
              className={cn(
                'relative aspect-3/4 w-full overflow-hidden rounded-lg transition',
                active === i
                  ? 'ring-2 ring-[#c49a68] ring-offset-1 ring-offset-[#0d0804]'
                  : 'opacity-50 hover:opacity-80',
              )}
            >
              <Image
                src={url}
                alt={`${title} photo ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
                {...blurProps(blurDataUrls[i])}
              />
            </button>
          ))}
        </div>
      )}

      {/* Carousel — explicit portrait-fit dimensions, stays sane on 4K */}
      <div className="relative h-[min(85vh,900px)] w-[min(70vh,675px)]">
        {stage}

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              disabled={isFirst}
              onMouseUp={stopPointer}
              onClick={() => goTo(active - 1)}
              className={cn(CONTROL_CLASS.overlayArrow, 'left-3')}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              disabled={isLast}
              onMouseUp={stopPointer}
              onClick={() => goTo(active + 1)}
              className={cn(CONTROL_CLASS.overlayArrow, 'right-3')}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>

            {/* Mobile thumbnail dots */}
            <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5 sm:hidden">
              {imageUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseUp={stopPointer}
                  onClick={() => goTo(i)}
                  aria-label={`View photo ${i + 1}`}
                  className={cn(
                    'size-2 rounded-full transition',
                    active === i ? 'bg-white' : 'bg-white/40',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Keeps a control's mouse-up off the stage, which cycles zoom on a bare click. */
function stopPointer(e: React.MouseEvent): void {
  e.stopPropagation();
}
