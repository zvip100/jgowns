'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Cropper from 'react-easy-crop';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

import { fitZoom, minZoomToCover } from '@/lib/image-upload';
import { cn } from '@/lib/utils';

import {
  MAX_STUDIO_ZOOM,
  positionEdits,
  zoomEdits,
  zoomFloor,
} from './photo-studio-draft';

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from 'react-easy-crop';
import type { EditableImage, PhotoEdits, PhotoStudioItem } from '@/lib/types';

type Size = { width: number; height: number };

const CARD_FILL = '#efe7dc';
const WINDOW_RADIUS = '1.7rem';
const SWIPE_THRESHOLD = 40;
const NEAR_CENTER_PX = 0.5;
/** The detail page photo: half of its max-w-5xl grid minus the gap. */
const DETAIL_PHOTO_WIDTH = 488;
/** Desktop: the floating tool bar (48px, 16px off the bottom) plus a 12px gap. */
const DOCK_SPACE = 76;
const FRAME_MARGIN = 16;

/** Inline because react-easy-crop injects unlayered CSS that would beat a utility class. */
const CROP_AREA_STYLE: CSSProperties = {
  color: 'rgba(245, 240, 231, 0.8)',
  border: '1px solid rgba(120, 93, 63, 0.35)',
  borderRadius: WINDOW_RADIUS,
};

const NAV_BUTTON_CLASS =
  'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-[rgba(120,93,63,0.18)] bg-white/95 text-(--ink) shadow-[0_4px_12px_rgba(20,12,5,0.18)] disabled:opacity-40 sm:grid';

const GRID_LINE_CLASS =
  'absolute bg-[#fdf9f2]/75 shadow-[0_0_0.5px_rgba(49,38,29,0.55)]';

/**
 * Exact 3:4 in whole pixels, up to the detail page size. Leaves room for the
 * nav buttons and the floating tool bar on desktop, swipe zones on phones.
 */
function frameSize(stage: Size, isWide: boolean): Size {
  const maxWidth = Math.min(stage.width - (isWide ? 112 : 64), DETAIL_PHOTO_WIDTH);
  const maxHeight = stage.height - (isWide ? DOCK_SPACE + FRAME_MARGIN : 40);
  const unit = Math.max(0, Math.floor(Math.min(maxWidth / 3, maxHeight / 4)));
  return { width: 3 * unit, height: 4 * unit };
}

/** How far the window sits above the stage center on desktop, clear of the tool bar. */
function frameLift(isWide: boolean): number {
  return isWide ? (DOCK_SPACE - FRAME_MARGIN) / 2 : 0;
}

/** react-easy-crop's own sizing: the photo contained in the stage, never upscaled. */
function mediaSize(image: EditableImage, stage: Size): Size {
  const scale = Math.min(1, stage.width / image.width, stage.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function useStageSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return isWide;
}

function ThirdsGrid({ size }: { size: Size }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
      style={{ ...size, borderRadius: WINDOW_RADIUS }}
    >
      <span className={cn(GRID_LINE_CLASS, 'inset-y-0 left-1/3 w-px')} />
      <span className={cn(GRID_LINE_CLASS, 'inset-y-0 left-2/3 w-px')} />
      <span className={cn(GRID_LINE_CLASS, 'inset-x-0 top-1/3 h-px')} />
      <span className={cn(GRID_LINE_CLASS, 'inset-x-0 top-2/3 h-px')} />
    </div>
  );
}

type EditableCropperProps = {
  image: EditableImage;
  edits: PhotoEdits;
  stage: Size;
  frame: Size;
  onUpdate: (update: (edits: PhotoEdits, image: EditableImage) => PhotoEdits) => void;
};

/**
 * Server framing shows the whole photo at its fit zoom with the card fill as
 * bars, pinned to center; any pan or zoom-in hands over to a crop (spec §5.1).
 */
function EditableCropper({ image, edits, stage, frame, onUpdate }: EditableCropperProps) {
  const media = mediaSize(image, stage);
  const coverZoom = minZoomToCover({
    mediaWidth: media.width,
    mediaHeight: media.height,
    cropWidth: frame.width,
    cropHeight: frame.height,
    rotation: edits.rotation90,
  });
  const isServer = edits.framing === 'server';
  const serverZoom = fitZoom({
    mediaWidth: media.width,
    mediaHeight: media.height,
    cropWidth: frame.width,
    cropHeight: frame.height,
    rotation90: edits.rotation90,
  });
  const zoom = isServer ? serverZoom : edits.zoom * coverZoom;
  const crop: Point = isServer
    ? { x: 0, y: 0 }
    : { x: edits.position.x * frame.width, y: edits.position.y * frame.height };

  return (
    <Cropper
      image={image.src}
      crop={crop}
      zoom={zoom}
      rotation={edits.rotation90 + edits.tilt}
      aspect={3 / 4}
      cropSize={frame}
      minZoom={isServer ? serverZoom : zoomFloor(image, edits) * coverZoom}
      maxZoom={MAX_STUDIO_ZOOM * coverZoom}
      zoomSpeed={coverZoom}
      keyboardStep={8}
      restrictPosition={!isServer}
      showGrid={false}
      onCropChange={(location) => {
        if (
          isServer &&
          Math.abs(location.x) < NEAR_CENTER_PX &&
          Math.abs(location.y) < NEAR_CENTER_PX
        ) {
          return;
        }
        onUpdate((current, source) =>
          positionEdits(source, current, {
            x: location.x / frame.width,
            y: location.y / frame.height,
          }),
        );
      }}
      onZoomChange={(next) =>
        onUpdate((current, source) => zoomEdits(source, current, next / coverZoom))
      }
      style={{
        containerStyle: { background: CARD_FILL },
        mediaStyle: { filter: `brightness(${1 + edits.brightness / 100})` },
        cropAreaStyle: CROP_AREA_STYLE,
      }}
      mediaProps={{ alt: image.name }}
      cropperProps={{ 'aria-label': 'Crop window. Use the arrow keys to move the photo.' }}
    />
  );
}

type PhotoStudioStageProps = {
  item: PhotoStudioItem;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onUpdate: (update: (edits: PhotoEdits, image: EditableImage) => PhotoEdits) => void;
};

export function PhotoStudioStage({
  item,
  index,
  count,
  onPrev,
  onNext,
  onUpdate,
}: PhotoStudioStageProps) {
  const { ref, size } = useStageSize();
  const isWide = useIsWide();
  const swipeStartRef = useRef<number | null>(null);
  const frame = size ? frameSize(size, isWide) : null;
  const lift = frameLift(isWide);

  const onSwipeStart = (event: ReactPointerEvent) => {
    swipeStartRef.current = event.clientX;
  };
  const onSwipeEnd = (event: ReactPointerEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start === null) return;
    const delta = event.clientX - start;
    if (delta <= -SWIPE_THRESHOLD) onNext();
    if (delta >= SWIPE_THRESHOLD) onPrev();
  };

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-(--bg-ivory)">
      {size && frame && frame.height > 0 && (
        <>
          {/* Taller than the stage and clipped at the top: the window clears the tool bar, the photo still runs under it. */}
          <div className="absolute inset-x-0 bottom-0" style={{ top: -2 * lift }}>
            {item.kind === 'new' ? (
              <EditableCropper
                key={item.id}
                image={item.image}
                edits={item.edits}
                stage={{ width: size.width, height: size.height + 2 * lift }}
                frame={frame}
                onUpdate={onUpdate}
              />
            ) : (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-[rgba(120,93,63,0.35)] bg-[#efe7dc]"
                style={{ ...frame, borderRadius: WINDOW_RADIUS }}
              >
                <Image
                  src={item.url}
                  alt={`Photo ${index + 1}`}
                  fill
                  sizes={`${DETAIL_PHOTO_WIDTH}px`}
                  unoptimized
                  className="object-cover"
                />
                <p className="absolute inset-x-3 bottom-3 flex items-start gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-[0.7rem] leading-snug text-(--ink) shadow-sm">
                  <Lock className="mt-px size-3 shrink-0 text-(--accent-deep)" aria-hidden />
                  Published photos can&apos;t be edited. Remove it and add a new one to change it.
                </p>
              </div>
            )}
            {item.kind === 'new' && <ThirdsGrid size={frame} />}
          </div>

          {count > 1 && (
            <>
              {(['left-0', 'right-0'] as const).map((side) => (
                <div
                  key={side}
                  aria-hidden
                  className={cn('absolute inset-y-0 z-10 touch-none sm:hidden', side)}
                  style={{ width: (size.width - frame.width) / 2 }}
                  onPointerDown={onSwipeStart}
                  onPointerUp={onSwipeEnd}
                  onPointerCancel={() => (swipeStartRef.current = null)}
                />
              ))}
              <button
                type="button"
                onClick={onPrev}
                disabled={index === 0}
                aria-label="Previous photo"
                className={cn(NAV_BUTTON_CLASS, 'left-3')}
                style={{ marginTop: -lift }}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={index === count - 1}
                aria-label="Next photo"
                className={cn(NAV_BUTTON_CLASS, 'right-3')}
                style={{ marginTop: -lift }}
              >
                <ChevronRight className="size-4" />
              </button>
              <div aria-hidden className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5 sm:hidden">
                {Array.from({ length: count }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full bg-(--line) transition-[width,background-color]',
                      i === index ? 'w-4 bg-(--accent-deep)' : 'w-1.5',
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
