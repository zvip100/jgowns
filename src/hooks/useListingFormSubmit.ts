'use client';

import { useCallback, useState, type RefObject } from 'react';
import { isValidSizePair } from '@/lib/gown-sizes';
import { dataUrlToFile } from '@/lib/image-upload';
import { createListing, updateListing } from '@/lib/actions/sell';
import {
  GOWN_CATEGORIES,
  type GownCategoryId,
  type ListingFormData,
  type SizeGroupSlug,
} from '@/lib/types';

function digitsOnlyPhone(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function buildInitialForm(
  initial?: Partial<ListingFormData>,
): Partial<ListingFormData> {
  const base: Partial<ListingFormData> = {
    title: '',
    description: '',
    size: '',
    color: '',
    location: '',
    condition: undefined,
    price: undefined,
    contact_email: '',
    contact_phone: '',
    status: 'active',
    ...initial,
  };
  const raw = base.category;
  const category =
    raw && GOWN_CATEGORIES.some((c) => c.id === raw) ? raw : null;

  return {
    ...base,
    category,
    contact_phone: digitsOnlyPhone(base.contact_phone),
  };
}

type ListingImageUploadState = {
  imageFile: File | null;
  optimizedDataUrl: string | null;
  blurDataUrlRef: RefObject<Promise<string | null>>;
};

type UseListingFormSubmitOptions = {
  initial?: Partial<ListingFormData>;
  listingId?: string;
  image: ListingImageUploadState;
};

export function useListingFormSubmit({
  initial,
  listingId,
  image,
}: UseListingFormSubmitOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<ListingFormData>>(() =>
    buildInitialForm(initial),
  );

  const setField = useCallback(
    (key: keyof ListingFormData, value: string | number) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const setSizeSelection = useCallback(
    (selection: { size: string; sizeGroup: SizeGroupSlug }) => {
      setForm((f) => ({
        ...f,
        size: selection.size,
        size_group: selection.sizeGroup,
      }));
    },
    [],
  );

  const setCategory = useCallback((value: string) => {
    const category = GOWN_CATEGORIES.some((c) => c.id === value)
      ? (value as GownCategoryId)
      : null;
    setForm((f) => {
      const keepSize =
        category &&
        f.size &&
        f.size_group &&
        isValidSizePair(category, f.size_group, f.size);
      return {
        ...f,
        category,
        size: keepSize ? f.size : '',
        size_group: keepSize ? f.size_group : undefined,
      };
    });
  }, []);

  const clearImageUrl = useCallback(() => {
    setForm((f) => ({ ...f, image_url: undefined }));
  }, []);

  const setContactPhone = useCallback((value: string) => {
    setForm((f) => ({ ...f, contact_phone: digitsOnlyPhone(value) }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (
        !form.title?.trim() ||
        !form.size ||
        !form.size_group ||
        !form.location ||
        !form.condition ||
        form.price == null ||
        Number.isNaN(form.price) ||
        !form.contact_email?.trim() ||
        !form.category ||
        !GOWN_CATEGORIES.some((c) => c.id === form.category)
      ) {
        throw new Error('Please fill in all required fields.');
      }

      if (!listingId && !image.imageFile) {
        throw new Error('Please add a gown photo.');
      }
      if (listingId && !image.imageFile && !form.image_url?.trim()) {
        throw new Error('Please add a gown photo.');
      }

      const blur = await image.blurDataUrlRef.current;

      let uploadFile: File | null = null;
      if (image.optimizedDataUrl) {
        uploadFile = await dataUrlToFile(
          image.optimizedDataUrl,
          image.imageFile?.name ?? 'photo.jpg',
        );
      } else if (image.imageFile) {
        uploadFile = image.imageFile;
      }

      const formData = new FormData();

      formData.set('title', form.title.trim());
      formData.set('description', form.description?.trim() || '');
      formData.set('size', String(form.size));
      formData.set('size_group', String(form.size_group));
      formData.set('color', form.color?.trim() || '');
      formData.set('location', String(form.location));
      formData.set('condition', String(form.condition));
      formData.set('category', String(form.category));
      formData.set('price', String(form.price));
      formData.set('image_url', form.image_url || '');
      formData.set('image_blur_data_url', blur || '');
      formData.set('contact_email', form.contact_email.trim());
      formData.set('contact_phone', form.contact_phone?.trim() || '');
      formData.set('status', String(form.status ?? 'active'));
      if (uploadFile) formData.set('image_file', uploadFile);

      const result = listingId
        ? await updateListing(listingId, formData)
        : await createListing(formData);

      if (result?.error) throw new Error(result.error);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [form, listingId, image.imageFile, image.optimizedDataUrl, image.blurDataUrlRef]);

  return {
    form,
    setField,
    setSizeSelection,
    setCategory,
    setContactPhone,
    clearImageUrl,
    loading,
    error,
    handleSubmit,
    isEdit: Boolean(listingId),
  };
}
