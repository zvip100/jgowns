'use client';

import { useEffect, useRef } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import {
  Accessibility,
  Cursor,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom';

import type { ReactNode } from 'react';
import type { DragDropManager, DragEndEvent } from '@dnd-kit/dom';

type DragOperationEvent = Pick<DragEndEvent, 'operation'>;

/** Space alone picks a photo up, so Enter keeps its click. Touch waits for a press and hold, so the page still scrolls. */
const SENSORS = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === 'touch'
        ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
        : [new PointerActivationConstraints.Distance({ value: 5 })],
  }),
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ['Space'],
      cancel: ['Escape'],
      end: ['Space', 'Enter', 'Tab'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  }),
];

function positions(event: DragOperationEvent): { from: number; to: number } | null {
  const { source } = event.operation;
  if (!isSortable(source)) return null;
  return { from: source.initialIndex, to: source.index };
}

function coverSuffix(index: number): string {
  return index === 0 ? ' It is now the cover.' : '';
}

const ANNOUNCEMENTS = {
  dragstart: (event: DragOperationEvent) => {
    const moved = positions(event);
    return moved ? `Picked up photo ${moved.from + 1}.` : undefined;
  },
  dragover: (event: DragOperationEvent) => {
    const moved = positions(event);
    return moved ? `Photo ${moved.from + 1} is over position ${moved.to + 1}.` : undefined;
  },
  dragend: (event: DragEndEvent) => {
    const moved = positions(event);
    if (!moved) return undefined;
    if (event.canceled || moved.from === moved.to) {
      return `Photo ${moved.from + 1} stayed in position ${moved.from + 1}.`;
    }
    return `Photo ${moved.from + 1} moved to position ${moved.to + 1}.${coverSuffix(moved.to)}`;
  },
};

const ACCESSIBILITY = Accessibility.configure({
  announcements: ANNOUNCEMENTS,
  screenReaderInstructions: {
    draggable:
      'Press Space to pick up the photo. Use the arrow keys to move it, then press Space to drop it, or Escape to cancel.',
  },
});

type PhotoSortProviderProps = {
  onMove: (from: number, to: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  children: ReactNode;
};

/**
 * Sorting for a list of photos. No page-wide grabbing cursor, so a keyboard move never takes over the mouse;
 * a move in progress drops where it is on any click, or when the list unmounts or its route is hidden.
 */
export function PhotoSortProvider({ onMove, onDraggingChange, children }: PhotoSortProviderProps) {
  const managerRef = useRef<DragDropManager | null>(null);
  const stopOnClickRef = useRef<(() => void) | null>(null);

  useEffect(() => () => void managerRef.current?.actions.stop(), []);

  return (
    <DragDropProvider
      sensors={SENSORS}
      plugins={(defaults) =>
        defaults
          .filter((plugin) => plugin !== Cursor)
          .map((plugin) => (plugin === Accessibility ? ACCESSIBILITY : plugin))
      }
      onDragStart={(_event, manager) => {
        managerRef.current = manager;
        onDraggingChange?.(true);
        if (!(manager.dragOperation.activatorEvent instanceof KeyboardEvent)) return;
        const stop = () => manager.actions.stop();
        document.addEventListener('pointerdown', stop, { capture: true, once: true });
        stopOnClickRef.current = () => document.removeEventListener('pointerdown', stop, { capture: true });
      }}
      onDragEnd={(event) => {
        stopOnClickRef.current?.();
        stopOnClickRef.current = null;
        onDraggingChange?.(false);
        if (event.canceled) return;
        const moved = positions(event);
        if (moved && moved.from !== moved.to) onMove(moved.from, moved.to);
      }}
    >
      {children}
    </DragDropProvider>
  );
}
