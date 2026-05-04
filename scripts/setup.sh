#!/bin/bash

set -e

echo "👗 Setting up Jgowns — Wedding Gown Marketplace..."

# ── 1. Scaffold Next.js app ──────────────────────────────────────────────────
npx create-next-app@latest wedding-gown-marketplace \
  --typescript --tailwind --app --no-git \
  --no-eslint --import-alias "@/*" --yes

cd wedding-gown-marketplace

# ── 2. Install dependencies ──────────────────────────────────────────────────
npm install @supabase/supabase-js @supabase/ssr

# ── 3. Create folder structure ───────────────────────────────────────────────
mkdir -p app/auth/login app/auth/register
mkdir -p app/listings/\[id\]
mkdir -p app/dashboard/new app/dashboard/edit/\[id\]
mkdir -p components lib/supabase supabase

# ── 4. Write all files ───────────────────────────────────────────────────────

# .env.local.example
cat > .env.local.example << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_test_placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
EOF

cp .env.local.example .env.local

# supabase/schema.sql
cat > supabase/schema.sql << 'EOF'
create extension if not exists "uuid-ossp";

create table listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  size text not null,
  style text,
  condition text not null,
  price numeric(10,2) not null,
  image_url text,
  contact_email text not null,
  contact_phone text,
  status text default 'active' check (status in ('active', 'sold', 'draft')),
  created_at timestamp with time zone default now()
);

create table payment_intents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  amount numeric(10,2),
  currency text default 'usd',
  status text default 'pending',
  stripe_payment_intent_id text,
  created_at timestamp with time zone default now()
);

insert into storage.buckets (id, name, public) values ('gown-images', 'gown-images', true);

alter table listings enable row level security;

create policy "Public can view active listings" on listings for select using (status = 'active');
create policy "Sellers can view own listings" on listings for select using (auth.uid() = user_id);
create policy "Sellers can insert listings" on listings for insert with check (auth.uid() = user_id);
create policy "Sellers can update own listings" on listings for update using (auth.uid() = user_id);
create policy "Sellers can delete own listings" on listings for delete using (auth.uid() = user_id);

create policy "Public image access" on storage.objects for select using (bucket_id = 'gown-images');
create policy "Auth users can upload images" on storage.objects for insert with check (bucket_id = 'gown-images' and auth.role() = 'authenticated');
create policy "Users can delete own images" on storage.objects for delete using (bucket_id = 'gown-images' and auth.uid() = owner);
EOF

# lib/types.ts
cat > lib/types.ts << 'EOF'
export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  size: string;
  style: string | null;
  condition: string;
  price: number;
  image_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: 'active' | 'sold' | 'draft';
  created_at: string;
};

export type ListingFormData = Omit<Listing, 'id' | 'user_id' | 'created_at'> & {
  image_file?: File;
};

export const GOWN_SIZES = ['0','2','4','6','8','10','12','14','16','18','20','22','24'];
export const GOWN_STYLES = ['A-Line','Ball Gown','Mermaid','Sheath','Tea Length','Mini','Empire','Other'];
export const GOWN_CONDITIONS = ['New with tags','Like new','Excellent','Good','Fair'];
EOF

# lib/supabase/client.ts
cat > lib/supabase/client.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
EOF

# lib/supabase/server.ts
cat > lib/supabase/server.ts << 'EOF'
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
EOF

# middleware.ts
cat > middleware.ts << 'EOF'
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  return supabaseResponse;
}

export const config = { matcher: ['/dashboard/:path*'] };
EOF

# app/globals.css
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body { @apply text-stone-800; }
  h1, h2, h3 { font-family: var(--font-playfair); }
}
EOF

# app/layout.tsx
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Jgowns — Wedding Gown Marketplace',
  description: 'Buy and sell pre-loved wedding gowns',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-rose-50 min-h-screen`}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        <footer className="text-center py-8 text-sm text-rose-400 mt-12">
          © {new Date().getFullYear()} Jgowns. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
EOF

# components/Navbar.tsx
cat > components/Navbar.tsx << 'EOF'
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <nav className="bg-white shadow-sm border-b border-rose-100">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-playfair text-2xl text-rose-700 font-bold tracking-wide">
          💍 Jgowns
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-stone-600 hover:text-rose-600 transition">Browse</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-stone-600 hover:text-rose-600 transition">My Listings</Link>
              <Link href="/dashboard/new" className="bg-rose-600 text-white px-4 py-2 rounded-full hover:bg-rose-700 transition">+ List a Gown</Link>
              <button onClick={handleSignOut} className="text-stone-400 hover:text-rose-500 transition">Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-stone-600 hover:text-rose-600 transition">Sign In</Link>
              <Link href="/auth/register" className="bg-rose-600 text-white px-4 py-2 rounded-full hover:bg-rose-700 transition">Sell a Gown</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
EOF

# components/GownCard.tsx
cat > components/GownCard.tsx << 'EOF'
import Link from 'next/link';
import type { Listing } from '@/lib/types';

export default function GownCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="aspect-[3/4] bg-rose-100 overflow-hidden">
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rose-300 text-5xl">👗</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-playfair text-lg font-semibold text-stone-800 truncate">{listing.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-stone-500">Size {listing.size} · {listing.condition}</span>
          <span className="text-rose-600 font-bold text-lg">${listing.price.toLocaleString()}</span>
        </div>
        {listing.style && (
          <span className="inline-block mt-2 text-xs bg-rose-50 text-rose-500 px-2 py-1 rounded-full">{listing.style}</span>
        )}
      </div>
    </Link>
  );
}
EOF

# components/FilterBar.tsx
cat > components/FilterBar.tsx << 'EOF'
'use client';
import { GOWN_SIZES, GOWN_STYLES } from '@/lib/types';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    value ? p.set(key, value) : p.delete(key);
    router.push(`/?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <select onChange={e => update('size', e.target.value)} defaultValue={params.get('size') || ''}
        className="border border-rose-200 rounded-full px-4 py-2 text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-300">
        <option value="">All Sizes</option>
        {GOWN_SIZES.map(s => <option key={s} value={s}>Size {s}</option>)}
      </select>
      <select onChange={e => update('style', e.target.value)} defaultValue={params.get('style') || ''}
        className="border border-rose-200 rounded-full px-4 py-2 text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-300">
        <option value="">All Styles</option>
        {GOWN_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input type="number" placeholder="Max price" defaultValue={params.get('maxPrice') || ''}
        onChange={e => update('maxPrice', e.target.value)}
        className="border border-rose-200 rounded-full px-4 py-2 text-sm bg-white w-32 focus:outline-none focus:ring-2 focus:ring-rose-300" />
    </div>
  );
}
EOF

# components/ListingForm.tsx
cat > components/ListingForm.tsx << 'EOF'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GOWN_SIZES, GOWN_STYLES, GOWN_CONDITIONS, type ListingFormData } from '@/lib/types';

export default function ListingForm({ initial, listingId }: {
  initial?: Partial<ListingFormData>;
  listingId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(initial?.image_url || null);
  const [form, setForm] = useState<Partial<ListingFormData>>({
    title: '', description: '', size: '', style: '', condition: '',
    price: undefined, contact_email: '', contact_phone: '', status: 'active', ...initial,
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
      let image_url = form.image_url || null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('gown-images').upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('gown-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
      const payload = { ...form, image_url, user_id: user.id };
      if (listingId) {
        const { error } = await supabase.from('listings').update(payload).eq('id', listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('listings').insert(payload);
        if (error) throw error;
      }
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-rose-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white";

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Gown Title *</label>
        <input className={inputClass} placeholder="e.g. Vera Wang Ball Gown, Ivory" value={form.title} onChange={e => set('title', e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
        <textarea className={inputClass} rows={3} placeholder="Tell buyers about the gown..." value={form.description || ''} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Size *</label>
          <select className={inputClass} value={form.size} onChange={e => set('size', e.target.value)}>
            <option value="">Select size</option>
            {GOWN_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Style</label>
          <select className={inputClass} value={form.style || ''} onChange={e => set('style', e.target.value)}>
            <option value="">Select style</option>
            {GOWN_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Condition *</label>
          <select className={inputClass} value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="">Select condition</option>
            {GOWN_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Asking Price ($) *</label>
          <input className={inputClass} type="number" placeholder="500" value={form.price || ''} onChange={e => set('price', parseFloat(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Photo</label>
        <input type="file" accept="image/*" onChange={handleImage} className="text-sm text-stone-500" />
        {preview && <img src={preview} alt="Preview" className="mt-3 w-48 h-64 object-cover rounded-xl border border-rose-100" />}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Contact Email *</label>
          <input className={inputClass} type="email" placeholder="you@email.com" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Contact Phone</label>
          <input className={inputClass} type="tel" placeholder="(555) 000-0000" value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} />
        </div>
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
        💳 <strong>Listing fee:</strong> $9.99 per listing — payment integration coming soon.
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button onClick={handleSubmit} disabled={loading}
        className="w-full bg-rose-600 text-white py-3 rounded-full font-semibold hover:bg-rose-700 transition disabled:opacity-50">
        {loading ? 'Saving...' : listingId ? 'Update Listing' : 'Publish Listing'}
      </button>
    </div>
  );
}
EOF

# app/page.tsx
cat > app/page.tsx << 'EOF'
import { createClient } from '@/lib/supabase/server';
import GownCard from '@/components/GownCard';
import FilterBar from '@/components/FilterBar';
import type { Listing } from '@/lib/types';

export default async function HomePage({ searchParams }: { searchParams: Record<string, string> }) {
  const supabase = await createClient();
  let query = supabase.from('listings').select('*').eq('status', 'active').order('created_at', { ascending: false });
  if (searchParams.size) query = query.eq('size', searchParams.size);
  if (searchParams.style) query = query.eq('style', searchParams.style);
  if (searchParams.maxPrice) query = query.lte('price', parseFloat(searchParams.maxPrice));
  const { data: listings } = await query;

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="font-playfair text-4xl font-bold text-rose-800 mb-2">Find Your Dream Gown</h1>
        <p className="text-stone-500 text-lg">Beautiful pre-loved wedding gowns at a fraction of the price</p>
      </div>
      <FilterBar />
      {listings?.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <div className="text-6xl mb-4">👗</div>
          <p>No gowns found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {listings?.map((l: Listing) => <GownCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  );
}
EOF

# app/listings/[id]/page.tsx
cat > "app/listings/[id]/page.tsx" << 'EOF'
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function ListingPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', params.id).single();
  if (!listing) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-[3/4] bg-rose-100 rounded-2xl overflow-hidden">
          {listing.image_url
            ? <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-rose-300 text-8xl">👗</div>
          }
        </div>
        <div className="py-4">
          <h1 className="font-playfair text-3xl font-bold text-stone-800 mb-2">{listing.title}</h1>
          <p className="text-4xl font-bold text-rose-600 mb-4">${listing.price.toLocaleString()}</p>
          <div className="space-y-2 text-sm text-stone-600 mb-6">
            <p><span className="font-medium">Size:</span> {listing.size}</p>
            {listing.style && <p><span className="font-medium">Style:</span> {listing.style}</p>}
            <p><span className="font-medium">Condition:</span> {listing.condition}</p>
            <p className="text-xs text-stone-400">Listed {new Date(listing.created_at).toLocaleDateString()}</p>
          </div>
          {listing.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-stone-700 mb-1">About this gown</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{listing.description}</p>
            </div>
          )}
          <div className="bg-rose-50 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-rose-800">Contact the Seller</h3>
            <a href={`mailto:${listing.contact_email}`}
              className="flex items-center gap-2 w-full bg-rose-600 text-white py-3 rounded-full justify-center font-semibold hover:bg-rose-700 transition">
              ✉️ Email Seller
            </a>
            {listing.contact_phone && (
              <a href={`tel:${listing.contact_phone}`}
                className="flex items-center gap-2 w-full border border-rose-300 text-rose-700 py-3 rounded-full justify-center font-semibold hover:bg-rose-100 transition">
                📞 Call Seller
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

# app/auth/register/page.tsx
cat > app/auth/register/page.tsx << 'EOF'
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function RegisterPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : 'Check your email to confirm your account!');
    setLoading(false);
  };

  const inputClass = "w-full border border-rose-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300";

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h1 className="font-playfair text-3xl font-bold text-rose-800 mb-2 text-center">Create Account</h1>
        <p className="text-center text-stone-500 text-sm mb-6">Start selling your wedding gown today</p>
        <div className="space-y-4">
          <input className={inputClass} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={inputClass} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <button onClick={handleRegister} disabled={loading}
            className="w-full bg-rose-600 text-white py-3 rounded-full font-semibold hover:bg-rose-700 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
          <p className="text-center text-sm text-stone-500">
            Already have an account? <Link href="/auth/login" className="text-rose-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
EOF

# app/auth/login/page.tsx
cat > app/auth/login/page.tsx << 'EOF'
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else router.push('/dashboard');
  };

  const inputClass = "w-full border border-rose-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300";

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h1 className="font-playfair text-3xl font-bold text-rose-800 mb-2 text-center">Welcome Back</h1>
        <p className="text-center text-stone-500 text-sm mb-6">Sign in to manage your listings</p>
        <div className="space-y-4">
          <input className={inputClass} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={inputClass} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-rose-600 text-white py-3 rounded-full font-semibold hover:bg-rose-700 transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-stone-500">
            New here? <Link href="/auth/register" className="text-rose-600 hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
EOF

# app/dashboard/page.tsx
cat > app/dashboard/page.tsx << 'EOF'
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Listing } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: listings } = await supabase.from('listings').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-playfair text-3xl font-bold text-rose-800">My Listings</h1>
        <Link href="/dashboard/new" className="bg-rose-600 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-rose-700 transition text-sm">
          + New Listing
        </Link>
      </div>
      {!listings?.length ? (
        <div className="text-center py-20 text-stone-400">
          <div className="text-6xl mb-4">👗</div>
          <p className="mb-4">You haven't listed any gowns yet.</p>
          <Link href="/dashboard/new" className="text-rose-600 hover:underline">List your first gown →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((l: Listing) => (
            <div key={l.id} className="bg-white rounded-2xl p-5 flex items-center gap-5 shadow-sm">
              <div className="w-16 h-20 bg-rose-100 rounded-xl overflow-hidden flex-shrink-0">
                {l.image_url
                  ? <img src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">👗</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-800 truncate">{l.title}</h3>
                <p className="text-sm text-stone-500">Size {l.size} · ${l.price.toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                  l.status === 'active' ? 'bg-green-100 text-green-700' :
                  l.status === 'sold' ? 'bg-stone-100 text-stone-500' : 'bg-yellow-100 text-yellow-700'
                }`}>{l.status}</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/listings/${l.id}`} className="text-sm text-rose-600 hover:underline">View</Link>
                <Link href={`/dashboard/edit/${l.id}`} className="text-sm text-stone-500 hover:underline">Edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

# app/dashboard/new/page.tsx
cat > app/dashboard/new/page.tsx << 'EOF'
import ListingForm from '@/components/ListingForm';

export default function NewListingPage() {
  return (
    <div>
      <h1 className="font-playfair text-3xl font-bold text-rose-800 mb-8 text-center">List Your Gown</h1>
      <ListingForm />
    </div>
  );
}
EOF

# app/dashboard/edit/[id]/page.tsx
cat > "app/dashboard/edit/[id]/page.tsx" << 'EOF'
import { createClient } from '@/lib/supabase/server';
import ListingForm from '@/components/ListingForm';
import { notFound } from 'next/navigation';

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', params.id).single();
  if (!listing) notFound();

  return (
    <div>
      <h1 className="font-playfair text-3xl font-bold text-rose-800 mb-8 text-center">Edit Listing</h1>
      <ListingForm initial={listing} listingId={params.id} />
    </div>
  );
}
EOF

echo ""
echo "✅ All files created!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next steps:"
echo ""
echo "  1. Go to https://supabase.com and create a project"
echo "  2. Run supabase/schema.sql in the SQL editor"
echo "  3. Edit .env.local with your Supabase credentials"
echo "  4. Run: npm run dev"
echo "  5. Open: http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"