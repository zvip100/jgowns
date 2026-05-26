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
