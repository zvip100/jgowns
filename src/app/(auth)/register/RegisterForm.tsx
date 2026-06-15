'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { TextInputField } from '@/components/form/TextInputField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';

export default function RegisterForm() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setMsg('');
    setIsError(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      setIsError(!!error);
      setMsg(error ? error.message : 'Check your email to confirm your account!');
    } catch (err) {
      setIsError(true);
      setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
      <FieldGroup>
        <TextInputField
          id="email"
          label="Email"
          type="email"
          placeholder="example@gmail.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInputField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {msg && (
          <Alert
            className={isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"}
            role="alert"
          >
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
        <p className="text-center text-sm text-[#7d6652]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-[#a0733f] hover:text-[#8e6330]"
          >
            Sign in
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
