'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { TextInputField } from '@/components/form/TextInputField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';

export default function RegisterPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(
      error
        ? error.message
        : 'Check your email to confirm your account!',
    );
    setLoading(false);
  };

  return (
    <div className="mx-auto mt-12 max-w-md sm:mt-20">
      <div className="surface-panel hairline stagger-rise rounded-[1.7rem] p-7 sm:p-9">
        <div className="mb-7 text-center">
          <h1 className="text-[2rem] text-[#2f241b]">Create Account</h1>
          <p className="mt-2 text-sm text-[#7d6652]">
            Start selling your wedding gown today
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
          {msg && (
            <Alert
              className="border-red-200 bg-red-50 text-red-700"
              role="alert"
            >
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}
          <button
            type="button"
            onClick={handleRegister}
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
      </div>
    </div>
  );
}
