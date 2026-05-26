'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TextInputField } from '@/components/form/TextInputField';
import { FieldError, FieldGroup } from '@/components/ui/field';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md sm:mt-20">
      <div className="surface-panel hairline stagger-rise rounded-[1.7rem] p-7 sm:p-9">
        <div className="mb-7 text-center">
          <h1 className="text-[2rem] text-[#2f241b]">Welcome Back</h1>
          <p className="mt-2 text-sm text-[#7d6652]">
            Sign in to manage your listings
          </p>
        </div>
        <FieldGroup>
          <TextInputField
            id="email"
            label="Email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextInputField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <FieldError>{error}</FieldError>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-[#7d6652]">
            New here?{' '}
            <Link
              href="/register"
              className="font-semibold text-[#a0733f] hover:text-[#8e6330]"
            >
              Create an account
            </Link>
          </p>
        </FieldGroup>
      </div>
    </div>
  );
}
