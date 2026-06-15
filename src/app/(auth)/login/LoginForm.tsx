'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TextInputField } from '@/components/form/TextInputField';
import { FieldError, FieldGroup } from '@/components/ui/field';

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) return setError(signInError.message);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <FieldGroup>
        <TextInputField
          id="email"
          label="Email"
          type="email"
          placeholder="example@gmail.com"
          autoComplete='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInputField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          autoComplete='current-password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <FieldError>{error}</FieldError>}
        <button
          type="submit"
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
    </form>
  );
}
