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
import { ListingPhotoField } from '@/components/ListingPhotoField';
import { ListingSizesField } from '@/components/ListingSizesField';
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
import { useListingImageSlots } from '@/hooks/useListingImageSlots';
import { PRIMARY_CTA_CLASS } from '@/lib/styles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';

type ListingFormProps = {
  initial?: Partial<ListingFormData>;
  listingId?: string;
};

export default function ListingForm({
  initial,
  listingId,
}: ListingFormProps) {
  const { slots, onFileSelected, onClear, resolveUploadFile } =
    useListingImageSlots({
      initialUrls: initial?.image_urls ?? [],
      initialBlurUrls: initial?.image_blur_data_urls ?? [],
    });

  const {
    form,
    setField,
    setCategory,
    setContactPhone,
    sizesController,
    loading,
    error,
    handleSubmit,
    isEdit,
  } = useListingFormSubmit({
    initial,
    listingId,
    slots,
    resolveUploadFile,
  });

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
        </FormFieldGrid>

        <ListingSizesField
          category={form.category ?? null}
          controller={sizesController}
        />

        <ListingPhotoField
          slots={slots}
          onFileSelected={onFileSelected}
          onClear={onClear}
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
              placeholder="example@gmail.com"
              autoComplete="email"
              value={form.contact_email || ''}
              onChange={(e) => setField('contact_email', e.target.value)}
              leading={<Mail />}
            />
            <InputGroupField
              id="contact_phone"
              label="Phone"
              type="tel"
              placeholder="(555) 000-0000"
              autoComplete="tel"
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
          disabled={loading || slots.some((s) => s.optimizing)}
          className={`${PRIMARY_CTA_CLASS} h-12 disabled:translate-y-0`}
        >
          {loading ? 'Saving…' : isEdit ? 'Update Listing' : 'Publish Listing'}
        </Button>
      </FieldGroup>
    </form>
  );
}
