import type { Area } from 'react-easy-crop';
import type { EditableImage, PhotoEdits } from '@/lib/types';

const MAX_UPLOAD_DIMENSION = 2400;
const MAX_CROP_UNIT = 600;
const HEIC_MAX_DIMENSION = 3600;
const HEIC_MAX_PIXELS = 12_000_000;
const HEIC_QUALITY = 0.92;
const EXPORT_QUALITY = 0.9;
const FILL_COLOR = '#efe7dc';
export const UNREADABLE_PHOTO_ERROR = "This photo can't be opened. Try a JPG or PNG.";
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

type Size = { width: number; height: number };

type CoverZoomInput = {
  mediaWidth: number;
  mediaHeight: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
};

type FitZoomInput = Omit<CoverZoomInput, 'rotation'> & { rotation90: number };

/** Reads the ISO-BMFF brand, so a HEIC renamed to .jpg is still caught. */
async function hasHeicSignature(file: File): Promise<boolean> {
  try {
    const header = new TextDecoder('latin1').decode(
      await file.slice(0, 12).arrayBuffer(),
    );
    return header.slice(4, 8) === 'ftyp' && HEIC_BRANDS.has(header.slice(8, 12));
  } catch {
    return false;
  }
}

export function rotatedBoundingBox(
  width: number,
  height: number,
  degrees: number,
): Size {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { width: cos * width + sin * height, height: sin * width + cos * height };
}

/** The zoom at which the rotated photo fully covers a centered crop window. */
export function minZoomToCover({
  mediaWidth,
  mediaHeight,
  cropWidth,
  cropHeight,
  rotation,
}: CoverZoomInput): number {
  const box = rotatedBoundingBox(cropWidth, cropHeight, rotation);
  return Math.max(box.width / mediaWidth, box.height / mediaHeight);
}

/** The zoom at which the whole photo, turned by quarter turns only, fits inside the window. */
export function fitZoom({
  mediaWidth,
  mediaHeight,
  cropWidth,
  cropHeight,
  rotation90,
}: FitZoomInput): number {
  const box = rotatedBoundingBox(mediaWidth, mediaHeight, rotation90);
  return Math.min(cropWidth / box.width, cropHeight / box.height);
}

/** Exact 3:4 by construction, at most 1800x2400, never upscaled. */
export function outputSize(crop: Area): Size {
  const unit = Math.max(
    1,
    Math.floor(Math.min(crop.width / 3, crop.height / 4, MAX_CROP_UNIT)),
  );
  return { width: 3 * unit, height: 4 * unit };
}

/** The whole photo after quarter turns, long edge capped at 2400, never upscaled. */
export function serverFramingSize(
  width: number,
  height: number,
  rotation90: number,
): Size {
  const isTurned = rotation90 % 180 !== 0;
  const turnedWidth = isTurned ? height : width;
  const turnedHeight = isTurned ? width : height;
  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(turnedWidth, turnedHeight));
  return {
    width: Math.round(turnedWidth * scale),
    height: Math.round(turnedHeight * scale),
  };
}

/** Same math as CSS `filter: brightness()`, which the studio uses for its live preview. */
export function applyBrightness(data: Uint8ClampedArray, percent: number): void {
  if (percent === 0) return;
  const factor = 1 + percent / 100;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * factor);
    data[i + 1] = Math.min(255, data[i + 1] * factor);
    data[i + 2] = Math.min(255, data[i + 2] * factor);
  }
}

let webpEncodingSupport: boolean | null = null;

/** Safari cannot encode WebP; testing once avoids encoding every photo twice there. */
export function supportsWebpEncoding(): boolean {
  if (webpEncodingSupport !== null) return webpEncodingSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpEncodingSupport = canvas
      .toDataURL('image/webp')
      .startsWith('data:image/webp');
  } catch {
    webpEncodingSupport = false;
  }
  return webpEncodingSupport;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Frees the backing store now rather than whenever the canvas is collected. */
function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * HEIC, which Chrome and Edge cannot decode, goes through a lazily loaded
 * decoder and one JPEG encode. Capped at 3600px and 12MP: enough detail for a
 * zoomed crop, with headroom under iOS Safari's canvas limit.
 */
async function openHeicImage(file: File): Promise<EditableImage | null> {
  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    bitmap = await (await import('heic-to')).heicTo({ blob: file, type: 'bitmap' });
    const scale = Math.min(
      1,
      HEIC_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(HEIC_MAX_PIXELS / (bitmap.width * bitmap.height)),
    );
    canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', HEIC_QUALITY);
    if (!blob) return null;
    return {
      src: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      name: file.name,
    };
  } catch {
    return null;
  } finally {
    bitmap?.close();
    releaseCanvas(canvas);
  }
}

/**
 * Decodes a picked photo for the studio. Browsers apply EXIF orientation to
 * `<img>` and to drawing it, so the size measured here is the one the cropper
 * and the export both use. Resolves null when the browser cannot read it.
 */
export async function openEditableImage(file: File): Promise<EditableImage | null> {
  if (await hasHeicSignature(file)) return openHeicImage(file);

  let src: string | null = null;
  try {
    src = URL.createObjectURL(file);
    const img = await loadImage(src);
    if (!img) {
      URL.revokeObjectURL(src);
      return null;
    }
    return { src, width: img.naturalWidth, height: img.naturalHeight, name: file.name };
  } catch {
    if (src) URL.revokeObjectURL(src);
    return null;
  }
}

/**
 * Draws the seller's edits into the file that gets uploaded. A crop is drawn
 * straight onto the output canvas, never through a full-size intermediate;
 * server framing sends the whole photo so the server adds its own bars.
 * Resolves null on any failure, which callers treat as an unreadable photo.
 */
export async function exportEditedImage(
  image: EditableImage,
  edits: PhotoEdits,
): Promise<File | null> {
  let canvas: HTMLCanvasElement | null = null;
  try {
    const img = await loadImage(image.src);
    if (!img) return null;

    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    if (edits.framing === 'crop' && edits.crop) {
      const { crop } = edits;
      const size = outputSize(crop);
      const degrees = edits.rotation90 + edits.tilt;
      const box = rotatedBoundingBox(image.width, image.height, degrees);
      canvas.width = size.width;
      canvas.height = size.height;
      context.scale(size.width / crop.width, size.height / crop.height);
      context.translate(-crop.x, -crop.y);
      context.translate(box.width / 2, box.height / 2);
      context.rotate((degrees * Math.PI) / 180);
      context.drawImage(img, -image.width / 2, -image.height / 2, image.width, image.height);
    } else {
      const size = serverFramingSize(image.width, image.height, edits.rotation90);
      const scale = Math.max(size.width, size.height) / Math.max(image.width, image.height);
      canvas.width = size.width;
      canvas.height = size.height;
      context.translate(size.width / 2, size.height / 2);
      context.rotate((edits.rotation90 * Math.PI) / 180);
      context.drawImage(
        img,
        (-image.width * scale) / 2,
        (-image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
    }

    if (edits.brightness !== 0) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      applyBrightness(pixels.data, edits.brightness);
      context.putImageData(pixels, 0, 0);
    }

    // Behind the photo and after brightness, so a corner exposed by a tilt
    // exports as the same unbrightened cream the studio shows.
    if (edits.framing === 'crop') {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = FILL_COLOR;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const type = supportsWebpEncoding() ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, type, EXPORT_QUALITY);
    if (!blob) return null;

    const base = image.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`, { type });
  } catch {
    return null;
  } finally {
    releaseCanvas(canvas);
  }
}

export async function dataUrlToFile(
  dataUrl: string,
  filename: string,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const base = filename.replace(/\.[^.]+$/, '') || 'photo';
  const ext =
    blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/avif'
          ? 'avif'
          : 'jpg';
  return new File([blob], `${base}.${ext}`, {
    type: blob.type || 'image/jpeg',
  });
}

export function generateBlurDataUrl(source: File | string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const objectUrl = typeof source !== 'string' ? URL.createObjectURL(source) : null;
      const src = typeof source === 'string' ? source : objectUrl!;
      img.onload = () => {
        try {
          const maxDim = 32;
          const ratio = img.width / img.height;
          const w = ratio >= 1 ? maxDim : Math.round(maxDim * ratio);
          const h = ratio >= 1 ? Math.round(maxDim / ratio) : maxDim;

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } catch {
          resolve(null);
        } finally {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}
