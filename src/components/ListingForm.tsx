'use client';

import { CircleDollarSign, Mail, Phone } from 'lucide-react';
import {
  CONTACT_METHODS,
  CONTACT_METHOD_LABELS,
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  LOCATIONS,
  type GownCondition,
  type ListingFormData,
} from '@/lib/types';
import { ListingPhotoField } from '@/components/ListingPhotoField';
import { ListingSizesField } from '@/components/ListingSizesField';
import { FORM_LABEL_CLASS } from '@/components/form/constants';
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
import { CHECKBOX_GOLD_CLASS, PRIMARY_CTA_CLASS } from '@/lib/styles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { Label } from '@/components/ui/label';

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
    contactMethods,
    toggleContactMethod,
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

  const hasPhone = Boolean(form.contact_phone?.trim());

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
          description="Add at least one way for buyers to reach you."
        >
          <FormFieldGrid>
            <InputGroupField
              id="contact_email"
              label="Email"
              type="email"
              placeholder="example@gmail.com"
              autoComplete="email"
              value={form.contact_email || ''}
              onChange={(e) => setField('contact_email', e.target.value)}
              onClear={() => setField('contact_email', '')}
              leading={<Mail />}
            />
            <div className="flex flex-col gap-3">
              <InputGroupField
                id="contact_phone"
                label="Phone"
                type="tel"
                placeholder="(555) 000-0000"
                autoComplete="tel"
                value={form.contact_phone || ''}
                onChange={(e) => setContactPhone(e.target.value)}
                onClear={() => setContactPhone('')}
                leading={<Phone />}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className={FORM_LABEL_CLASS}>Buyers can</span>
                {CONTACT_METHODS.map((method) => (
                  <div key={method} className="flex items-center gap-2">
                    <Checkbox
                      id={`contact-method-${method}`}
                      checked={contactMethods.includes(method)}
                      disabled={!hasPhone}
                      className={CHECKBOX_GOLD_CLASS}
                      onCheckedChange={(checked) =>
                        toggleContactMethod(method, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`contact-method-${method}`}
                      className="font-normal"
                    >
                      {CONTACT_METHOD_LABELS[method]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </FormFieldGrid>
        </FormSection>

        <Alert className="border-(--line) bg-(--bg-cream)">
          <CircleDollarSign className="text-(--accent-deep)" />
          <AlertTitle className="font-semibold tracking-tight">
            Listing fee: free for a limited time
          </AlertTitle>
          <AlertDescription>This is a limited time offer.</AlertDescription>
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
