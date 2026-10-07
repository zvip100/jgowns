'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Trash2 } from 'lucide-react';

import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  MAX_BRIGHTNESS,
  MAX_STUDIO_ZOOM,
  MAX_TILT,
  brightnessEdits,
  fitZoomRelative,
  initialEdits,
  rotateEdits,
  tiltEdits,
  zoomEdits,
  zoomFloor,
} from './photo-studio-draft';

import type { EditableImage, PhotoEdits, PhotoStudioItem } from '@/lib/types';

type Tool = 'zoom' | 'tilt' | 'brightness';

type ToolControl = {
  min: number;
  max: number;
  step: number;
  value: number;
  readout: string;
  apply: (edits: PhotoEdits, image: EditableImage, value: number) => PhotoEdits;
};

const TOOL_LABELS: Record<Tool, string> = {
  zoom: 'Zoom',
  tilt: 'Straighten',
  brightness: 'Brightness',
};

const ICON_BUTTON_CLASS =
  'grid size-8 shrink-0 place-items-center rounded-full border border-border bg-white text-(--muted-ink) transition-colors hover:text-(--ink) disabled:opacity-40';

function signed(value: number, unit: string): string {
  return `${value > 0 ? '+' : ''}${value}${unit}`;
}

function toolControl(tool: Tool, image: EditableImage, edits: PhotoEdits): ToolControl {
  if (tool === 'tilt') {
    return {
      min: -MAX_TILT,
      max: MAX_TILT,
      step: 0.5,
      value: edits.tilt,
      readout: signed(edits.tilt, '°'),
      apply: (current, source, value) => tiltEdits(source, current, value),
    };
  }
  if (tool === 'brightness') {
    return {
      min: -MAX_BRIGHTNESS,
      max: MAX_BRIGHTNESS,
      step: 1,
      value: edits.brightness,
      readout: signed(edits.brightness, '%'),
      apply: (current, _source, value) => brightnessEdits(current, value),
    };
  }
  const isServer = edits.framing === 'server';
  const min = isServer ? fitZoomRelative(image, edits.rotation90) : zoomFloor(image, edits);
  return {
    min,
    max: MAX_STUDIO_ZOOM,
    step: 0.05,
    value: isServer ? min : edits.zoom,
    readout: isServer ? 'Fit' : `${edits.zoom.toFixed(1)}×`,
    apply: (current, source, value) => zoomEdits(source, current, value),
  };
}

type PhotoStudioToolbarProps = {
  item: PhotoStudioItem | undefined;
  onUpdate: (update: (edits: PhotoEdits, image: EditableImage) => PhotoEdits) => void;
  /** Single mode has no rail, so removing the photo lives here. */
  onRemove?: () => void;
};

/** One floating bar on desktop, a strip under the stage on phones. */
export function PhotoStudioToolbar({ item, onUpdate, onRemove }: PhotoStudioToolbarProps) {
  const [tool, setTool] = useState<Tool>('zoom');
  const isEditable = item?.kind === 'new';
  const control = isEditable ? toolControl(tool, item.image, item.edits) : null;
  const sliderRef = useRef<HTMLSpanElement>(null);

  // Radix names a lone thumb only from its own props, which the shadcn Slider does not forward.
  useEffect(() => {
    sliderRef.current?.querySelector('[role="slider"]')?.setAttribute('aria-label', TOOL_LABELS[tool]);
  }, [tool]);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-(--line) bg-(--bg-cream) px-4 py-3 sm:absolute sm:bottom-4 sm:left-1/2 sm:z-20 sm:-translate-x-1/2 sm:flex-nowrap sm:rounded-full sm:border sm:border-border sm:bg-white sm:py-1.5 sm:pl-1.5 sm:pr-2 sm:shadow-[0_12px_28px_rgba(60,40,20,0.16)]">
      <ToggleGroup
        type="single"
        spacing={1}
        value={tool}
        onValueChange={(next) => next && setTool(next as Tool)}
        disabled={!isEditable}
        aria-label="Adjustment"
        className="rounded-full border border-border bg-(--bg-ivory) p-0.5"
      >
        {(Object.keys(TOOL_LABELS) as Tool[]).map((key) => (
          <ToggleGroupItem
            key={key}
            value={key}
            size="sm"
            className="rounded-full px-3 text-xs font-semibold text-(--muted-ink) hover:bg-white/60 data-[state=on]:bg-white data-[state=on]:text-(--ink) data-[state=on]:shadow-[0_1px_3px_rgba(60,40,20,0.14)]"
          >
            {TOOL_LABELS[key]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="order-3 flex w-full items-center gap-3 sm:order-none sm:w-44">
        <Slider
          ref={sliderRef}
          min={control?.min ?? 0}
          max={control?.max ?? 1}
          step={control?.step ?? 1}
          value={[control?.value ?? 0]}
          disabled={!control}
          aria-label={TOOL_LABELS[tool]}
          onValueChange={([value]) => {
            if (!control || value === undefined) return;
            onUpdate((edits, image) => control.apply(edits, image, value));
          }}
        />
        <output
          aria-live="polite"
          className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-(--ink)"
        >
          {control?.readout ?? ''}
        </output>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
        <span aria-hidden className="mr-1 hidden h-5 w-px bg-(--line) sm:block" />
        <button
          type="button"
          onClick={() => onUpdate((edits, image) => rotateEdits(image, edits))}
          disabled={!isEditable}
          aria-label="Rotate 90°"
          title="Rotate 90°"
          className={ICON_BUTTON_CLASS}
        >
          <RotateCw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onUpdate((_edits, image) => initialEdits(image))}
          disabled={!isEditable}
          aria-label="Reset"
          title="Reset"
          className={ICON_BUTTON_CLASS}
        >
          <RotateCcw className="size-3.5" />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={!item}
            aria-label="Remove photo"
            title="Remove photo"
            className={cn(ICON_BUTTON_CLASS, 'hover:text-(--error)')}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
