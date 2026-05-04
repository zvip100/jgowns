'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ListingForm({ initial, listingId }: {
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

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
        const { error: uploadError } = await supabase.storage.from('gown-images').upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('gown-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
      const category = form.category as GownCategoryId;
      const payload = {
        title: form.title!.trim(),
        description: form.description?.trim() || null,
        size: form.size!,
        color: form.color || null,
        location: form.location!,
        condition: form.condition!,
        category,
        price: form.price!,
        image_url,
        contact_email: form.contact_email!.trim(),
        contact_phone: form.contact_phone?.trim() || null,
        status: form.status ?? 'active',
        user_id: user.id,
      };
      if (listingId) {
        const { error } = await supabase.from('listings').update(payload).eq('id', listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('listings').insert(payload);
        if (error) throw error;
      }
      await revalidateListings();
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-[#d9c9b6] bg-white/70 px-4 py-3 text-sm font-medium text-[#5f4e3f] placeholder:text-[#b09d8c] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:ring-2 focus:ring-(--focus-ring)';
  const labelClass = 'block text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462] mb-1.5';

  return (
    <div className='mx-auto max-w-2xl space-y-5 surface-panel hairline rounded-[1.7rem] p-7 sm:p-9'>
      <div>
        <label htmlFor='title' className={labelClass}>Gown Title *</label>
        <input id='title' className={inputClass} placeholder='e.g. Vera Wang Ball Gown, Ivory' value={form.title} onChange={e => set('title', e.target.value)} />
      </div>
      <div>
        <label htmlFor='description' className={labelClass}>Description</label>
        <textarea id='description' className={inputClass} rows={3} placeholder='Tell buyers about the gown…' value={form.description || ''} onChange={e => set('description', e.target.value)} />
      </div>
      <div>
        <label htmlFor='category' className={labelClass}>Category *</label>
        <select
          id='category'
          className={inputClass}
          value={form.category ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setForm((f) => ({
              ...f,
              category:
                v && GOWN_CATEGORIES.some((c) => c.id === v)
                  ? (v as GownCategoryId)
                  : null,
            }));
          }}
        >
          <option value=''>Select category</option>
          {GOWN_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <label htmlFor='size' className={labelClass}>Size *</label>
          <select id='size' className={inputClass} value={form.size} onChange={e => set('size', e.target.value)}>
            <option value=''>Select size</option>
            {GOWN_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor='color' className={labelClass}>Color</label>
          <select id='color' className={inputClass} value={form.color || ''} onChange={e => set('color', e.target.value)}>
            <option value=''>Select color</option>
            {GOWN_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <label htmlFor='location' className={labelClass}>Your Location *</label>
          <select id='location' className={inputClass} value={form.location || ''} onChange={e => set('location', e.target.value)}>
            <option value=''>Select location</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor='price' className={labelClass}>Asking Price ($) *</label>
          <input id='price' className={inputClass} type='number' placeholder='500' value={form.price || ''} onChange={e => set('price', parseFloat(e.target.value))} />
        </div>
      </div>

      <div>
        <label htmlFor='condition' className={labelClass}>Condition *</label>
        <select id='condition' className={inputClass} value={form.condition || ''} onChange={e => set('condition', e.target.value as GownCondition)}>
          <option value=''>Select condition</option>
          {GOWN_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor='photo' className={labelClass}>Photo</label>
        <input id='photo' type='file' accept='image/*' onChange={handleImage} className='text-sm text-[#7d6652] file:mr-4 file:cursor-pointer file:rounded-full file:border file:border-[#d4c2ad] file:bg-white/70 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-[#5f4e3f] file:transition hover:file:bg-white' />
        {preview && <img src={preview} alt='Preview' className='mt-3 h-64 w-48 rounded-2xl border border-[#d9c9b6] object-cover' />}
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <label htmlFor='contact_email' className={labelClass}>Contact Email *</label>
          <input id='contact_email' className={inputClass} type='email' placeholder='you@email.com' value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
        </div>
        <div>
          <label htmlFor='contact_phone' className={labelClass}>Contact Phone</label>
          <input id='contact_phone' className={inputClass} type='tel' placeholder='(555) 000-0000' value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} />
        </div>
      </div>
      <div className='rounded-2xl border border-[#d9c9b6] bg-[#fffaf3] px-4 py-3 text-sm text-[#7d6652]'>
        💳 <strong className='text-[#5a4537]'>Listing fee:</strong> $9.99 per listing — payment integration coming soon.
      </div>
      {error && <p className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' role='alert'>{error}</p>}
      <button onClick={handleSubmit} disabled={loading}
        className='w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50'>
        {loading ? 'Saving…' : listingId ? 'Update Listing' : 'Publish Listing'}
      </button>
    </div>
  );
}
