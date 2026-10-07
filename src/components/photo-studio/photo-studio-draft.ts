import { fitZoom, minZoomToCover, rotatedBoundingBox } from '@/lib/image-upload';
import { keepsEnoughForCover } from '@/lib/images/cover-rule';

import type { Area, Point } from 'react-easy-crop';
import type { EditableImage, PhotoEdits, PhotoStudioItem } from '@/lib/types';

export const MAX_STUDIO_ZOOM = 3;
export const MAX_TILT = 15;
export const MAX_BRIGHTNESS = 30;

const CARD_WIDTH = 3;
const CARD_HEIGHT = 4;
const EPSILON = 1e-3;
const CENTER: Point = { x: 0, y: 0 };

export function tooManyPhotosNote(max: number): string {
  return `Up to ${max} photos. Extra photos weren't added.`;
}

type NewStudioItem = Extract<PhotoStudioItem, { kind: 'new' }>;

export type StudioDraft = {
  items: PhotoStudioItem[];
  initialItems: PhotoStudioItem[];
  activeId: string | null;
  maxItems: number;
  note: string;
};

export type StudioDraftAction =
  | { type: 'open'; items: PhotoStudioItem[]; maxItems: number; activeIndex: number }
  | { type: 'add'; items: NewStudioItem[] }
  | { type: 'remove'; id: string }
  | { type: 'move'; from: number; to: number }
  | { type: 'select'; id: string }
  | { type: 'note'; message: string }
  | {
      type: 'update';
      id: string;
      update: (edits: PhotoEdits, image: EditableImage) => PhotoEdits;
    };

function turnedSize(image: EditableImage, rotation90: number) {
  return rotation90 % 180 === 0
    ? { width: image.width, height: image.height }
    : { width: image.height, height: image.width };
}

function coverZoomAt(image: EditableImage, rotation: number): number {
  return minZoomToCover({
    mediaWidth: image.width,
    mediaHeight: image.height,
    cropWidth: CARD_WIDTH,
    cropHeight: CARD_HEIGHT,
    rotation,
  });
}

/** The studio's relative zoom floor: 1, raised by a tilt so the centered window has no empty corners. */
export function zoomFloor(image: EditableImage, edits: PhotoEdits): number {
  return (
    coverZoomAt(image, edits.rotation90 + edits.tilt) /
    coverZoomAt(image, edits.rotation90)
  );
}

/** Server framing's zoom on the same relative scale: below 1 whenever bars show. */
export function fitZoomRelative(image: EditableImage, rotation90: number): number {
  return (
    fitZoom({
      mediaWidth: image.width,
      mediaHeight: image.height,
      cropWidth: CARD_WIDTH,
      cropHeight: CARD_HEIGHT,
      rotation90,
    }) / coverZoomAt(image, rotation90)
  );
}

/** What the server would do on its own decides how a photo opens (spec §5.1). */
export function framingFor(
  image: EditableImage,
  rotation90: PhotoEdits['rotation90'],
): PhotoEdits['framing'] {
  const turned = turnedSize(image, rotation90);
  return keepsEnoughForCover(turned.width, turned.height) ? 'crop' : 'server';
}

/** The window in source pixels of the rotated photo, mirroring react-easy-crop's own math. */
export function cropAreaFor(image: EditableImage, edits: PhotoEdits): Area {
  const turned = turnedSize(image, edits.rotation90);
  const coverWidth = Math.min(turned.width, (turned.height * CARD_WIDTH) / CARD_HEIGHT);
  const width = coverWidth / edits.zoom;
  const height = (width * CARD_HEIGHT) / CARD_WIDTH;
  const box = rotatedBoundingBox(image.width, image.height, edits.rotation90 + edits.tilt);
  return {
    x: Math.round((box.width - width) / 2 - edits.position.x * width),
    y: Math.round((box.height - height) / 2 - edits.position.y * height),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function clampPosition(image: EditableImage, edits: PhotoEdits): Point {
  const turned = turnedSize(image, edits.rotation90);
  const coverWidth = Math.min(turned.width, (turned.height * CARD_WIDTH) / CARD_HEIGHT);
  const width = coverWidth / edits.zoom;
  const height = (width * CARD_HEIGHT) / CARD_WIDTH;
  const box = rotatedBoundingBox(image.width, image.height, edits.rotation90 + edits.tilt);
  const maxX = Math.abs(box.width / width - 1) / 2;
  const maxY = Math.abs(box.height / height - 1) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, edits.position.x)),
    y: Math.min(maxY, Math.max(-maxY, edits.position.y)),
  };
}

/** Keeps zoom, position and the derived crop consistent with the rest of the edits. */
function settle(image: EditableImage, edits: PhotoEdits): PhotoEdits {
  if (edits.framing === 'server') {
    return { ...edits, tilt: 0, zoom: 1, position: CENTER, crop: null };
  }
  const zoom = Math.min(MAX_STUDIO_ZOOM, Math.max(zoomFloor(image, edits), edits.zoom));
  const zoomed = { ...edits, zoom };
  const position = clampPosition(image, zoomed);
  const settled = { ...zoomed, position };
  return { ...settled, crop: cropAreaFor(image, settled) };
}

function centeredAt(
  image: EditableImage,
  edits: PhotoEdits,
  framing: PhotoEdits['framing'],
): PhotoEdits {
  return settle(image, { ...edits, framing, zoom: 1, position: CENTER });
}

/** The opening view for a photo, which Reset also returns to. */
export function initialEdits(image: EditableImage): PhotoEdits {
  const edits: PhotoEdits = {
    framing: framingFor(image, 0),
    crop: null,
    rotation90: 0,
    tilt: 0,
    brightness: 0,
    zoom: 1,
    position: CENTER,
  };
  return settle(image, edits);
}

/** A quarter turn keeps the framing, except that a server-framed photo re-runs the rule. */
export function rotateEdits(image: EditableImage, edits: PhotoEdits): PhotoEdits {
  const rotation90 = ((edits.rotation90 + 90) % 360) as PhotoEdits['rotation90'];
  const turned = { ...edits, rotation90 };
  const framing = edits.framing === 'server' ? framingFor(image, rotation90) : 'crop';
  return centeredAt(image, turned, framing);
}

export function tiltEdits(image: EditableImage, edits: PhotoEdits, tilt: number): PhotoEdits {
  const clamped = Math.min(MAX_TILT, Math.max(-MAX_TILT, tilt));
  if (edits.framing === 'server') {
    if (clamped === 0) return edits;
    return centeredAt(image, { ...edits, tilt: clamped }, 'crop');
  }
  return settle(image, { ...edits, tilt: clamped });
}

/** Zooming past the fit view is the seller reframing, so it switches to a crop. */
export function zoomEdits(image: EditableImage, edits: PhotoEdits, zoom: number): PhotoEdits {
  if (edits.framing === 'server') {
    if (zoom <= fitZoomRelative(image, edits.rotation90) + EPSILON) return edits;
    return settle(image, { ...edits, framing: 'crop', zoom, position: CENTER });
  }
  return settle(image, { ...edits, zoom });
}

/** Dragging a server-framed photo is reframing too; it starts from the centered cover view. */
export function positionEdits(
  image: EditableImage,
  edits: PhotoEdits,
  position: Point,
): PhotoEdits {
  if (edits.framing === 'server') {
    if (Math.abs(position.x) < EPSILON && Math.abs(position.y) < EPSILON) return edits;
    return centeredAt(image, edits, 'crop');
  }
  return settle(image, { ...edits, position });
}

export function brightnessEdits(edits: PhotoEdits, brightness: number): PhotoEdits {
  return {
    ...edits,
    brightness: Math.min(MAX_BRIGHTNESS, Math.max(-MAX_BRIGHTNESS, Math.round(brightness))),
  };
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** Equal as the seller sees them; `crop` is derived, so it is not compared. */
export function editsEqual(a: PhotoEdits | null, b: PhotoEdits | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.framing === b.framing &&
    a.rotation90 === b.rotation90 &&
    near(a.tilt, b.tilt) &&
    near(a.brightness, b.brightness) &&
    near(a.zoom, b.zoom) &&
    near(a.position.x, b.position.x) &&
    near(a.position.y, b.position.y)
  );
}

function sameItem(a: PhotoStudioItem, b: PhotoStudioItem): boolean {
  if (a.id !== b.id || a.kind !== b.kind) return false;
  if (a.kind === 'uploaded' || b.kind === 'uploaded') return true;
  return a.image.src === b.image.src && editsEqual(a.edits, b.edits);
}

/** Anything added, removed, moved or edited since the studio opened (spec §5.3). */
export function isDraftDirty(draft: StudioDraft): boolean {
  if (draft.items.length !== draft.initialItems.length) return true;
  return draft.items.some((item, i) => !sameItem(item, draft.initialItems[i]));
}

/**
 * The object URL the draft itself created for an item, which it alone may
 * revoke. Sources handed in from an earlier session belong to the form.
 */
export function draftOwnedSource(draft: StudioDraft, item: PhotoStudioItem): string | null {
  if (item.kind !== 'new') return null;
  const isInherited = draft.initialItems.some(
    (initial) => initial.kind === 'new' && initial.image.src === item.image.src,
  );
  return isInherited ? null : item.image.src;
}

/** Everything a confirmed discard has to revoke. */
export function draftOwnedSources(draft: StudioDraft): string[] {
  return draft.items
    .map((item) => draftOwnedSource(draft, item))
    .filter((src): src is string => src !== null);
}

export function remainingSlots(draft: StudioDraft): number {
  return Math.max(0, draft.maxItems - draft.items.length);
}

export function isEditable(item: PhotoStudioItem | undefined): item is NewStudioItem {
  return item?.kind === 'new';
}

export function activeIndexOf(draft: StudioDraft): number {
  const index = draft.items.findIndex((item) => item.id === draft.activeId);
  return index === -1 ? 0 : index;
}

/** A copy with one item moved; the same array when the move is out of range or a no-op. */
export function moveItem<Item>(items: Item[], from: number, to: number): Item[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function emptyDraft(): StudioDraft {
  return { items: [], initialItems: [], activeId: null, maxItems: 1, note: '' };
}

export function studioDraftReducer(
  draft: StudioDraft,
  action: StudioDraftAction,
): StudioDraft {
  switch (action.type) {
    case 'open':
      return {
        items: action.items,
        initialItems: action.items,
        activeId: action.items[action.activeIndex]?.id ?? action.items[0]?.id ?? null,
        maxItems: action.maxItems,
        note: '',
      };
    case 'add': {
      const accepted = action.items.slice(0, remainingSlots(draft));
      if (accepted.length === 0) return draft;
      return {
        ...draft,
        items: [...draft.items, ...accepted],
        activeId: accepted[0].id,
      };
    }
    case 'remove': {
      const index = draft.items.findIndex((item) => item.id === action.id);
      if (index === -1) return draft;
      const items = draft.items.filter((item) => item.id !== action.id);
      const activeId =
        draft.activeId === action.id
          ? (items[Math.min(index, items.length - 1)]?.id ?? null)
          : draft.activeId;
      return { ...draft, items, activeId, note: '' };
    }
    case 'move': {
      const items = moveItem(draft.items, action.from, action.to);
      return items === draft.items ? draft : { ...draft, items };
    }
    case 'select':
      return draft.items.some((item) => item.id === action.id)
        ? { ...draft, activeId: action.id }
        : draft;
    case 'note':
      return { ...draft, note: action.message };
    case 'update': {
      let changed = false;
      const items = draft.items.map((item) => {
        if (item.id !== action.id || item.kind !== 'new') return item;
        const edits = action.update(item.edits, item.image);
        if (edits === item.edits) return item;
        changed = true;
        return { ...item, edits };
      });
      return changed ? { ...draft, items } : draft;
    }
  }
}
