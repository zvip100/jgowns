'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, CircleDollarSign, Loader2, Mail, Phone, X } from 'lucide-react';
import { getSizeSelectGroups, isValidSizeForCategory } from '@/lib/gown-sizes';
import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  LOCATIONS,
  type GownCategoryId,
  type GownCondition,
  type ListingFormData,
} from '@/lib/types';
import { optimizeListingPhoto } from '@/lib/actions/images';
import { createListing, updateListing } from '@/lib/actions/sell';
import { cn } from '@/lib/utils';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const labelTone =
  'text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--muted-ink)';

function digitsOnlyPhone(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
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

type Option = { value: string; label: string };
const toOpts = (xs: readonly string[]): Option[] =>
  xs.map((x) => ({ value: x, label: x }));

function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  required,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className={labelTone}>
        {label}
        {required && ' *'}
      </FieldLabel>
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-8 w-full bg-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

const sizePickerTriggerClass =
  'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const sizePickerPanelClass =
  'absolute z-50 mt-1 max-h-[min(18rem,55vh)] w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md';

const sizeGroupTriggerClass =
  'py-2 px-2.5 text-sm font-normal text-foreground hover:bg-muted/40 hover:no-underline [&[data-state=open]]:bg-muted/50';

const sizeOptionClass =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-input bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground';

function sizeGroupId(label: string, index: number) {
  return label
    ? label.toLowerCase().replace(/\s+/g, '-')
    : `group-${index}`;
}

function CategorySizeSelect({
  category,
  value,
  onChange,
}: {
  category: GownCategoryId | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const groups = category ? getSizeSelectGroups(category) : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPickerOpen(false);
    setOpenGroup('');
  }, [category]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const disabled = !category;
  const placeholder = category ? 'Select size' : 'Select category first';

  return (
    <Field>
      <FieldLabel htmlFor="size-picker" className={labelTone}>
        Size *
      </FieldLabel>
      <div ref={rootRef} className="relative">
        <button
          id="size-picker"
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          onClick={() => {
            if (!disabled) setPickerOpen((open) => !open);
          }}
          className={cn(
            sizePickerTriggerClass,
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              pickerOpen && 'rotate-180',
            )}
          />
        </button>

        {pickerOpen && category ? (
          <div className={sizePickerPanelClass} role="listbox">
            <Accordion
              type="single"
              collapsible
              value={openGroup}
              onValueChange={setOpenGroup}
              className="w-full"
            >
              {groups.map((group, index) => {
                const id = sizeGroupId(group.label, index);
                const title = group.label || 'Sizes';
                return (
                  <AccordionItem
                    key={id}
                    value={id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <AccordionTrigger className={sizeGroupTriggerClass}>
                      {title}
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-2 pb-2 h-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={value === o.value}
                            data-active={value === o.value}
                            onClick={() => {
                              onChange(o.value);
                              setPickerOpen(false);
                              setOpenGroup('');
                            }}
                            className={sizeOptionClass}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

export default function ListingForm({
  initial,
  listingId,
}: {
  initial?: Partial<ListingFormData>;
  listingId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageOptimizing, setImageOptimizing] = useState(false);
  const [imageOptimizeError, setImageOptimizeError] = useState('');
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.image_url || null);
  const [form, setForm] = useState<Partial<ListingFormData>>(() => {
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
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const blurDataUrlRef = useRef<Promise<string | null>>(
    Promise.resolve(initial?.image_blur_data_url ?? null),
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

  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      generateBlurDataUrl(result.dataUrl);
      return;
    }

    setImageOptimizeError(
      'error' in result && result.error
        ? `Failed to automatically optimize image. You can try uploading again. (${result.error.length > 140 ? `${result.error.slice(0, 137)}…` : result.error})`
        : 'Failed to automatically optimize image. You can try uploading again.',
    );
    generateBlurDataUrl(file);
  };

  const generateBlurDataUrl = (source: File | string) => {
    blurDataUrlRef.current = new Promise<string | null>((resolve) => {
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
            if (!ctx) { resolve(null); return; }

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
  };

  const clearImage = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setImageFile(null);
    setOptimizedDataUrl(null);
    setImageOptimizeError('');
    setPreview(null);
    blurDataUrlRef.current = Promise.resolve(null);
    setForm((f) => ({ ...f, image_url: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      if (
        !form.title?.trim() ||
        !form.size ||
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

      if (!listingId && !imageFile) {
        throw new Error('Please add a gown photo.');
      }
      if (listingId && !imageFile && !form.image_url?.trim()) {
        throw new Error('Please add a gown photo.');
      }

      const blur = await blurDataUrlRef.current;

      let uploadFile: File | null = null;
      if (optimizedDataUrl) {
        uploadFile = await dataUrlToFile(
          optimizedDataUrl,
          imageFile?.name ?? 'photo.jpg',
        );
      } else if (imageFile) {
        uploadFile = imageFile;
      }

      const formData = new FormData();

      formData.set('title', form.title.trim());
      formData.set('description', form.description?.trim() || '');
      formData.set('size', String(form.size));
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
        <Field>
          <FieldLabel htmlFor="title" className={labelTone}>
            Gown Title *
          </FieldLabel>
          <Input
            id="title"
            className="bg-card"
            placeholder="e.g. Vera Wang Ball Gown, Ivory"
            value={form.title || ''}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description" className={labelTone}>
            Description
          </FieldLabel>
          <Textarea
            id="description"
            rows={3}
            className="bg-card"
            placeholder="Tell buyers about the gown…"
            value={form.description || ''}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <SelectField
          id="category"
          label="Category"
          placeholder="Select category"
          required
          value={form.category ?? ''}
          options={GOWN_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(v) => {
            const category = GOWN_CATEGORIES.some((c) => c.id === v)
              ? (v as GownCategoryId)
              : null;
            setForm((f) => {
              const keepSize =
                category &&
                f.size &&
                isValidSizeForCategory(category, f.size);
              return {
                ...f,
                category,
                size: keepSize ? f.size : '',
              };
            });
          }}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CategorySizeSelect
            category={form.category ?? null}
            value={form.size || ''}
            onChange={(v) => set('size', v)}
          />
          <SelectField
            id="color"
            label="Color"
            placeholder="Select color"
            value={form.color || ''}
            options={toOpts(GOWN_COLORS)}
            onChange={(v) => set('color', v)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="location"
            label="Your Location"
            placeholder="Select location"
            required
            value={form.location || ''}
            options={toOpts(LOCATIONS)}
            onChange={(v) => set('location', v)}
          />
          <Field>
            <FieldLabel htmlFor="price" className={labelTone}>
              Asking Price *
            </FieldLabel>
            <InputGroup className="bg-card">
              <InputGroupAddon>
                <InputGroupText className="font-semibold text-foreground">$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="price"
                type="number"
                inputMode="decimal"
                placeholder="500"
                value={form.price ?? ''}
                onChange={(e) => set('price', parseFloat(e.target.value))}
              />
            </InputGroup>
          </Field>
        </div>

        <SelectField
          id="condition"
          label="Condition"
          placeholder="Select condition"
          required
          value={form.condition || ''}
          options={toOpts(GOWN_CONDITIONS)}
          onChange={(v) => set('condition', v as GownCondition)}
        />

        <Field>
          <FieldLabel htmlFor="photo" className={labelTone}>
            Photo *
          </FieldLabel>
          <Input
            id="photo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            className="h-auto max-w-xs cursor-pointer bg-card py-2 file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-secondary-foreground"
          />
          {preview && (
            <div className="mt-2">
              <div className="relative w-48">
                {imageOptimizing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 px-3 text-center backdrop-blur-sm">
                    <Loader2
                      className="size-8 shrink-0 animate-spin text-(--accent-deep)"
                      aria-hidden
                    />
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Optimizing image…
                    </span>
                  </div>
                )}
                <Image
                  src={preview}
                  alt="Preview"
                  width={192}
                  height={256}
                  sizes="192px"
                  unoptimized
                  className="h-64 w-48 rounded-2xl border border-border object-cover shadow-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={clearImage}
                  aria-label="Remove image"
                  className="absolute -right-2 -top-2 rounded-full border border-border bg-background text-foreground shadow-lg ring-1 ring-black/5 hover:bg-muted"
                >
                  <X />
                </Button>
              </div>
              {imageOptimizeError ? (
                <FieldError className="mt-2 max-w-xs">
                  {imageOptimizeError}
                </FieldError>
              ) : null}
            </div>
          )}
        </Field>

        <FieldSet>
          <FieldLegend variant="label" className={labelTone}>
            Contact
          </FieldLegend>
          <FieldDescription>
            How buyers will reach you about this listing.
          </FieldDescription>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contact_email" className={labelTone}>
                Email *
              </FieldLabel>
              <InputGroup className="bg-card">
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
                <InputGroupInput
                  id="contact_email"
                  type="email"
                  placeholder="you@email.com"
                  value={form.contact_email || ''}
                  onChange={(e) => set('contact_email', e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact_phone" className={labelTone}>
                Phone
              </FieldLabel>
              <InputGroup className="bg-card">
                <InputGroupAddon>
                  <Phone />
                </InputGroupAddon>
                <InputGroupInput
                  id="contact_phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={form.contact_phone || ''}
                  onChange={(e) =>
                    set('contact_phone', digitsOnlyPhone(e.target.value))
                  }
                />
              </InputGroup>
            </Field>
          </div>
        </FieldSet>

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
          disabled={loading || imageOptimizing}
          className="h-12 w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50"
        >
          {loading ? 'Saving…' : listingId ? 'Update Listing' : 'Publish Listing'}
        </Button>
      </FieldGroup>
    </form>
  );
}
