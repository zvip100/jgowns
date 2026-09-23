const MAX_UPLOAD_DIMENSION = 2400;
const DOWNSCALE_QUALITY = 0.9;
export const UNREADABLE_PHOTO_ERROR = "This photo can't be opened. Try a JPG or PNG.";
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

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

/**
 * Re-encodes every photo in the browser before it is uploaded: long edge capped
 * at 2400px, WebP (smaller than JPEG, keeps alpha). The server crops to
 * 1200x1600 anyway, so extra megabytes only buy upload time. HEIC, which Chrome
 * and Edge cannot decode, goes through a lazily loaded decoder. Resolves null
 * when the browser cannot read the image at all, so the caller can reject it;
 * the original is kept when re-encoding is unavailable or not smaller.
 */
export async function downscaleImageFile(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  const isHeic = await hasHeicSignature(file);
  // The HEIC original is never usable downstream, so a failed re-encode of one
  // is a rejection too.
  const fallback = isHeic ? null : file;

  let bitmap: ImageBitmap;
  try {
    // Canvas drops EXIF, so the bitmap has to arrive already rotated or a phone
    // photo would upload sideways and be stored that way.
    bitmap = isHeic
      ? await (await import('heic-to')).heicTo({ blob: file, type: 'bitmap' })
      : await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(
      1,
      MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return fallback;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', DOWNSCALE_QUALITY),
    );
    if (!blob) return fallback;
    if (!isHeic && blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  } catch {
    return fallback;
  } finally {
    bitmap.close();
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
