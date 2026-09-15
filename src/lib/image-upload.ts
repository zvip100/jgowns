const MAX_UPLOAD_DIMENSION = 2400;
const DOWNSCALE_ABOVE_BYTES = 2 * 1024 * 1024;
const DOWNSCALE_QUALITY = 0.9;

/**
 * Shrinks a large photo in the browser before it is uploaded. The server crops
 * every photo to 1200x1600 anyway, so the extra megabytes only buy upload time,
 * and a body that takes 15 to 40 seconds to send is what the dropped uploads had
 * in common. WebP because it re-encodes smaller than JPEG and keeps alpha. Any
 * file the browser cannot decode or re-encode falls through untouched.
 */
export async function downscaleImageFile(file: File): Promise<File> {
  if (file.size <= DOWNSCALE_ABOVE_BYTES) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    // Canvas drops EXIF, so the bitmap has to arrive already rotated or a phone
    // photo would upload sideways and be stored that way.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const scale = Math.min(
      1,
      MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', DOWNSCALE_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    bitmap?.close();
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
