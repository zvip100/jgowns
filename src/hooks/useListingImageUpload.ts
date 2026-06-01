'use client';

import { useEffect, useRef, useState } from 'react';
import { optimizeListingPhoto } from '@/lib/actions/images';
import { generateBlurDataUrl } from '@/lib/image-upload';

type UseListingImageUploadOptions = {
  initialPreview?: string | null;
  initialBlurDataUrl?: string | null;
};

export function useListingImageUpload({
  initialPreview = null,
  initialBlurDataUrl = null,
}: UseListingImageUploadOptions = {}) {
  const [imageOptimizing, setImageOptimizing] = useState(false);
  const [imageOptimizeError, setImageOptimizeError] = useState('');
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const blurDataUrlRef = useRef<Promise<string | null>>(
    Promise.resolve(initialBlurDataUrl),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewRef = useRef(preview);
  previewRef.current = preview;

  useEffect(() => {
    return () => {
      if (previewRef.current?.startsWith('blob:'))
        URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const setBlurFromSource = (source: File | string) => {
    blurDataUrlRef.current = generateBlurDataUrl(source);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);

    const tempPreviewUrl = URL.createObjectURL(file);
    setPreview(tempPreviewUrl);
    setImageFile(file);
    setOptimizedDataUrl(null);
    setImageOptimizeError('');
    setImageOptimizing(true);

    const optimizeForm = new FormData();
    optimizeForm.set('image', file);
    const result = await optimizeListingPhoto(optimizeForm);

    setImageOptimizing(false);

    if ('dataUrl' in result) {
      URL.revokeObjectURL(tempPreviewUrl);
      setPreview(result.dataUrl);
      setOptimizedDataUrl(result.dataUrl);
      setImageOptimizeError('');
      setBlurFromSource(result.dataUrl);
      return;
    }

    setImageOptimizeError(
      'error' in result && result.error
        ? `Failed to automatically optimize image. You can try uploading again. (${result.error.length > 140 ? `${result.error.slice(0, 137)}…` : result.error})`
        : 'Failed to automatically optimize image. You can try uploading again.',
    );
    setBlurFromSource(file);
  };

  const onClear = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setImageFile(null);
    setOptimizedDataUrl(null);
    setImageOptimizeError('');
    setPreview(null);
    blurDataUrlRef.current = Promise.resolve(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return {
    preview,
    imageOptimizing,
    imageOptimizeError,
    fileInputRef,
    onFileChange,
    onClear,
    imageFile,
    optimizedDataUrl,
    blurDataUrlRef,
  };
}
