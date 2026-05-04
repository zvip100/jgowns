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

  const inputClass = 'w-full rounded-2xl border border-[#d9c9b6] bg-white/70 px-4 py-3 text-sm font-medium text-[#5f4e3f] placeholder:text-[#b09d8c] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:ring-2 focus:ring-(--focus-ring)';
  const labelClass = 'block text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462] mb-1.5';

  return (
    <div className='mx-auto mt-12 max-w-md sm:mt-20'>
      <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-7 sm:p-9'>
        <div className='mb-7 text-center'>
          <h1 className='text-[2rem] text-[#2f241b]'>Welcome Back</h1>
          <p className='mt-2 text-sm text-[#7d6652]'>Sign in to manage your listings</p>
        </div>
        <div className='space-y-5'>
          <div>
            <label htmlFor='email' className={labelClass}>Email</label>
            <input id='email' className={inputClass} type='email' placeholder='you@email.com' value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor='password' className={labelClass}>Password</label>
            <input id='password' className={inputClass} type='password' placeholder='••••••••' value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700' role='alert'>{error}</p>}
          <button onClick={handleLogin} disabled={loading}
            className='w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50'>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className='text-center text-sm text-[#7d6652]'>
            New here?{' '}
            <Link href='/auth/register' className='font-semibold text-[#a0733f] hover:text-[#8e6330]'>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
