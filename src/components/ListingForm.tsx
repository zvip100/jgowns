'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CircleDollarSign, Mail, Phone, X } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  GOWN_CATEGORIES,
  GOWN_COLORS,
  GOWN_CONDITIONS,
  GOWN_SIZES,
  LOCATIONS,
  type GownCategoryId,
  type GownCondition,
  type ListingFormData,
} from '@/lib/types';
import { revalidateListings } from '@/lib/actions/listings';

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
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const labelTone =
  'text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--muted-ink)';

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
}: {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className={labelTone}>
        {label}
        {required && ' *'}
      </FieldLabel>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full bg-card">
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

export default function ListingForm({
  initial,
  listingId,
}: {
  initial?: Partial<ListingFormData>;
  listingId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    return { ...base, category };
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

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    generateBlurDataUrl(file);
  };

  const generateBlurDataUrl = (file: File) => {
    blurDataUrlRef.current = new Promise<string | null>((resolve) => {
      try {
        const img = new window.Image();
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
            URL.revokeObjectURL(img.src);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          resolve(null);
        };
        img.src = URL.createObjectURL(file);
      } catch {
        resolve(null);
      }
    });
  };

  const clearImage = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setImageFile(null);
    setPreview(null);
    blurDataUrlRef.current = Promise.resolve(null);
    setForm((f) => ({ ...f, image_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
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

      let image_url = form.image_url || null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('gown-images')
          .upload(path, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('gown-images')
          .getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        title: form.title!.trim(),
        description: form.description?.trim() || null,
        size: form.size!,
        color: form.color || null,
        location: form.location!,
        condition: form.condition!,
        category: form.category as GownCategoryId,
        price: form.price!,
        image_url,
        image_blur_data_url: imageFile
          ? await blurDataUrlRef.current
          : (image_url ? await blurDataUrlRef.current : null),
        contact_email: form.contact_email!.trim(),
        contact_phone: form.contact_phone?.trim() || null,
        status: form.status ?? 'active',
        user_id: user.id,
      };
      const { error: dbError } = listingId
        ? await supabase.from('listings').update(payload).eq('id', listingId)
        : await supabase.from('listings').insert(payload);
      if (dbError) throw dbError;
      await revalidateListings();
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
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
            className="h-10 bg-card"
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
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              category: GOWN_CATEGORIES.some((c) => c.id === v)
                ? (v as GownCategoryId)
                : null,
            }))
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="size"
            label="Size"
            placeholder="Select size"
            required
            value={form.size || ''}
            options={toOpts(GOWN_SIZES)}
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
            <InputGroup className="h-10 bg-card">
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
            Photo
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
              <InputGroup className="h-10 bg-card">
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
              <InputGroup className="h-10 bg-card">
                <InputGroupAddon>
                  <Phone />
                </InputGroupAddon>
                <InputGroupInput
                  id="contact_phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={form.contact_phone || ''}
                  onChange={(e) => set('contact_phone', e.target.value)}
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
          disabled={loading}
          className="h-12 w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50"
        >
          {loading ? 'Saving…' : listingId ? 'Update Listing' : 'Publish Listing'}
        </Button>
      </FieldGroup>
    </form>
  );
}
