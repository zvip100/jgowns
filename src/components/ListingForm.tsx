'use client';

import { CircleDollarSign, Mail, Phone } from 'lucide-react';
import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  LOCATIONS,
  type GownCondition,
  type ListingFormData,
} from '@/lib/types';
import { CategorySizeSelect } from '@/components/CategorySizeSelect';
import { ListingPhotoField } from '@/components/ListingPhotoField';
import { FormFieldGrid } from '@/components/form/FormFieldGrid';
import { FormSection } from '@/components/form/FormSection';
import { InputGroupField } from '@/components/form/InputGroupField';
import {
  SelectField,
  toSelectOptions,
} from '@/components/form/SelectField';
import { TextInputField } from '@/components/form/TextInputField';
import { TextareaField } from '@/components/form/TextareaField';
import { useListingFormSubmit } from '@/hooks/useListingFormSubmit';
import { useListingImageUpload } from '@/hooks/useListingImageUpload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';

export default function ListingForm({
  initial,
  listingId,
}: {
  initial?: Partial<ListingFormData>;
  listingId?: string;
}) {
  const image = useListingImageUpload({
    initialPreview: initial?.image_url ?? null,
    initialBlurDataUrl: initial?.image_blur_data_url ?? null,
  });

  const {
    form,
    setField,
    setSizeSelection,
    setCategory,
    setContactPhone,
    clearImageUrl,
    loading,
    error,
    handleSubmit,
    isEdit,
  } = useListingFormSubmit({
    initial,
    listingId,
    image: {
      imageFile: image.imageFile,
      optimizedDataUrl: image.optimizedDataUrl,
      blurDataUrlRef: image.blurDataUrlRef,
    },
  });

  const handleClearImage = () => {
    image.onClear();
    clearImageUrl();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="surface-panel hairline mx-auto max-w-2xl rounded-[1.7rem] p-7 sm:p-9"
    >
      <FieldGroup>
        <TextInputField
          id="title"
          label="Gown Title"
          required
          placeholder="e.g. Vera Wang Ball Gown, Ivory"
          value={form.title || ''}
          onChange={(e) => setField('title', e.target.value)}
        />

        <TextareaField
          id="description"
          label="Description"
          rows={3}
          placeholder="Tell buyers about the gown…"
          value={form.description || ''}
          onChange={(e) => setField('description', e.target.value)}
        />

        <FormFieldGrid>
          <SelectField
            id="category"
            label="Category"
            placeholder="Select category"
            required
            value={form.category ?? ''}
            options={GOWN_CATEGORIES.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            onChange={setCategory}
          />
          <SelectField
            id="condition"
            label="Condition"
            placeholder="Select condition"
            required
            value={form.condition || ''}
            options={toSelectOptions(GOWN_CONDITIONS)}
            onChange={(v) => setField('condition', v as GownCondition)}
          />
          <CategorySizeSelect
            category={form.category ?? null}
            size={form.size || ''}
            sizeGroup={form.size_group ?? null}
            onChange={setSizeSelection}
          />
          <SelectField
            id="color"
            label="Color"
            placeholder="Select color"
            value={form.color || ''}
            options={toSelectOptions(GOWN_COLORS)}
            onChange={(v) => setField('color', v)}
          />
          <SelectField
            id="location"
            label="Your Location"
            placeholder="Select location"
            required
            value={form.location || ''}
            options={toSelectOptions(LOCATIONS)}
            onChange={(v) => setField('location', v)}
          />
          <InputGroupField
            id="price"
            label="Asking Price"
            required
            leading="$"
            type="number"
            inputMode="decimal"
            placeholder="500"
            value={form.price ?? ''}
            onChange={(e) => setField('price', parseFloat(e.target.value))}
          />
        </FormFieldGrid>

        <ListingPhotoField
          fileInputRef={image.fileInputRef}
          preview={image.preview}
          imageOptimizing={image.imageOptimizing}
          imageOptimizeError={image.imageOptimizeError}
          onFileChange={image.onFileChange}
          onClear={handleClearImage}
        />

        <FormSection
          legend="Contact"
          description="How buyers will reach you about this listing."
        >
          <FormFieldGrid>
            <InputGroupField
              id="contact_email"
              label="Email"
              required
              type="email"
              placeholder="you@email.com"
              value={form.contact_email || ''}
              onChange={(e) => setField('contact_email', e.target.value)}
              leading={<Mail />}
            />
            <InputGroupField
              id="contact_phone"
              label="Phone"
              type="tel"
              placeholder="(555) 000-0000"
              value={form.contact_phone || ''}
              onChange={(e) => setContactPhone(e.target.value)}
              leading={<Phone />}
            />
          </FormFieldGrid>
        </FormSection>

        <Alert className="border-(--line) bg-(--bg-cream)">
          <CircleDollarSign className="text-(--accent-deep)" />
          <AlertTitle className="font-semibold tracking-tight">
            Listing fee — $9.99 per listing
          </AlertTitle>
          <AlertDescription>Payment integration coming soon.</AlertDescription>
        </Alert>

        {error && <FieldError>{error}</FieldError>}

        <Button
          type="submit"
          disabled={loading || image.imageOptimizing}
          className="h-12 w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50"
        >
          {loading ? 'Saving…' : isEdit ? 'Update Listing' : 'Publish Listing'}
        </Button>
      </FieldGroup>
    </form>
  );
}
