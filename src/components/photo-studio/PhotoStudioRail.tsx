'use client';

import Image from 'next/image';
import { GripVertical, ImagePlus, Lock, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useSortable } from '@dnd-kit/react/sortable';

import { cn } from '@/lib/utils';

import { PhotoSortProvider } from './PhotoSortProvider';

import type { PhotoStudioItem } from '@/lib/types';

const THUMB_CLASS =
  'relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-[0.6rem] sm:w-15';

function thumbnailSrc(item: PhotoStudioItem): string {
  return item.kind === 'new' ? item.image.src : item.url;
}

type RailThumbnailProps = {
  item: PhotoStudioItem;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

function RailThumbnail({ item, index, isActive, onSelect, onRemove }: RailThumbnailProps) {
  const { ref, handleRef, isDragSource } = useSortable({ id: item.id, index });
  const brightness = item.kind === 'new' ? item.edits.brightness : 0;

  return (
    <li ref={ref} className={cn('group/thumb relative', isDragSource && 'z-10 opacity-80 **:cursor-grabbing')}>
      <button
        ref={handleRef}
        type="button"
        onClick={() => onSelect(item.id)}
        aria-label={`Photo ${index + 1}${index === 0 ? ', cover' : ''}${item.kind === 'uploaded' ? ', published' : ''}`}
        aria-current={isActive || undefined}
        className={cn(
          THUMB_CLASS,
          'block cursor-grab touch-manipulation outline-2 outline-offset-2 outline-transparent transition-[outline-color] focus-visible:outline-(--focus-ring) active:cursor-grabbing',
          isActive && 'outline-accent',
        )}
      >
        <Image
          src={thumbnailSrc(item)}
          alt=""
          fill
          sizes="60px"
          unoptimized
          draggable={false}
          className="pointer-events-none object-cover"
          style={brightness ? { filter: `brightness(${1 + brightness / 100})` } : undefined}
        />
        {index === 0 && (
          <span className="absolute bottom-1 left-1 rounded-[0.3rem] bg-white/90 px-1 py-px text-[0.5rem] font-bold uppercase tracking-[0.08em] text-(--accent-deep)">
            Cover
          </span>
        )}
        {item.kind === 'uploaded' && (
          <span
            aria-hidden
            className="absolute left-1 top-1 grid size-4 place-items-center rounded-full bg-white/90 text-(--accent-deep)"
          >
            <Lock className="size-2.5" />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove photo ${index + 1}`}
        className="absolute -right-1.5 -top-1.5 z-10 grid size-5 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-muted"
      >
        <X className="size-3" />
      </button>
    </li>
  );
}

type PhotoStudioRailProps = {
  items: PhotoStudioItem[];
  activeId: string | null;
  remaining: number;
  note: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onAddFiles: (files: File[]) => void;
  onDraggingChange: (isDragging: boolean) => void;
};

/**
 * Vertical beside the stage on desktop, a strip under it on phones. One
 * sortable list serves both, since sorting follows where items actually sit.
 */
export function PhotoStudioRail({
  items,
  activeId,
  remaining,
  note,
  onSelect,
  onRemove,
  onMove,
  onAddFiles,
  onDraggingChange,
}: PhotoStudioRailProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted: File[]) => {
      if (accepted.length > 0) onAddFiles(accepted);
    },
    accept: { 'image/*': [] },
    multiple: true,
    useFsAccessApi: false,
    disabled: remaining === 0,
  });

  return (
    <div className="flex min-w-0 flex-col gap-2 border-(--line) bg-(--bg-cream) px-4 py-3 sm:w-26 sm:items-center sm:border-r sm:px-3 sm:py-4">
      <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.12em] text-(--muted-ink) sm:block">
        Photos
      </span>
      <PhotoSortProvider onMove={onMove} onDraggingChange={onDraggingChange}>
        <ol className="flex items-center gap-3 overflow-x-auto p-1.5 sm:flex-col sm:overflow-visible">
          {items.map((item, index) => (
            <RailThumbnail
              key={item.id}
              item={item}
              index={index}
              isActive={item.id === activeId}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
          {remaining > 0 && (
            <li>
              <div
                {...getRootProps({
                  role: 'button',
                  'aria-label': 'Add photos',
                  className: cn(
                    THUMB_CLASS,
                    'grid cursor-pointer place-items-center border-[1.5px] border-dashed border-(--line) bg-(--bg-cream) text-(--accent-deep) outline-none transition-colors hover:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--focus-ring)',
                    isDragActive && 'border-(--accent-deep) bg-(--bg-ivory)',
                  ),
                })}
              >
                <input {...getInputProps()} />
                <ImagePlus className="size-5" aria-hidden />
              </div>
            </li>
          )}
        </ol>
      </PhotoSortProvider>
      {note && (
        <p role="status" className="text-[0.7rem] leading-snug text-(--error) sm:text-center">
          {note}
        </p>
      )}
      {items.length > 1 && (
        <span className="hidden flex-col items-center gap-0.5 text-center text-[0.65rem] text-(--muted-ink) sm:mt-auto sm:flex">
          <GripVertical className="size-3.5" aria-hidden />
          Drag to reorder
        </span>
      )}
    </div>
  );
}
