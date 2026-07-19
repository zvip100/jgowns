'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { blurProps, cn } from '@/lib/utils';

const MAX_ZOOM = 4;

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

type LightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrls: string[];
  blurDataUrls: string[];
  title: string;
  startIndex: number;
};

export function Lightbox({
  open,
  onOpenChange,
  imageUrls,
  blurDataUrls,
  title,
  startIndex,
}: LightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex items-center justify-center h-dvh w-dvw max-w-none sm:max-w-none translate-x-0 translate-y-0 inset-0 rounded-none border-0 p-0 bg-black/80"
      >
        <DialogTitle className="sr-only">{title}: photo viewer</DialogTitle>

        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </DialogClose>

        <LightboxContent
          imageUrls={imageUrls}
          blurDataUrls={blurDataUrls}
          title={title}
          startIndex={startIndex}
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
};

/**
 * Interactive viewer area (carousel + zoom/pan + thumbnails). Radix only mounts a
 * DialogContent's children while the dialog is open, so this mounts fresh on every
 * open — letting useState/useEmblaCarousel initialize at `startIndex` with no sync effects.
 */
function LightboxContent({ imageUrls, blurDataUrls, title, startIndex }: LightboxContentProps) {
  const [active, setActive] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchDistRef = useRef<number | null>(null);
  const touchPanRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex });

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

  const handleThumbnailClick = (i: number) => {
    setActive(i);
    resetView();
    emblaApi?.scrollTo(i);
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

  return (
    <div className="flex items-center gap-5">
      {/* Left thumbnail strip, sits flush against carousel */}
      {imageUrls.length > 1 && (
        <div className="hidden w-20 shrink-0 flex-col items-center justify-center gap-4 sm:flex">
          {imageUrls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleThumbnailClick(i)}
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
      <div
        ref={containerRef}
        className="relative h-[min(85vh,900px)] w-[min(70vh,675px)]"
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
        <div ref={emblaRef} className="h-full overflow-hidden" style={{ pointerEvents: zoom > 1 ? 'none' : undefined }}>
          <div className="flex h-full">
            {imageUrls.map((url, i) => (
              <div
                key={i}
                className="relative h-full min-w-full overflow-hidden"
              >
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
                    sizes="(max-width: 640px) 100vw, 675px"
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

        {/* Mobile thumbnail dots */}
        {imageUrls.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 sm:hidden">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleThumbnailClick(i)}
                aria-label={`View photo ${i + 1}`}
                className={cn(
                  'size-2 rounded-full transition',
                  active === i ? 'bg-white' : 'bg-white/40',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
