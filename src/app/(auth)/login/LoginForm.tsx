'use client';

import { useLayoutEffect, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';

import { signIn } from '@/lib/actions/auth';
import { FieldError, FieldGroup } from '@/components/ui/field';

import {
  AuthAltLink,
  AuthEmailField,
  AuthPasswordField,
  AuthSubmitButton,
} from '../auth-form';

type LoginFormProps = { next: string };

export default function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    return () => setError('');
  }, []);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signIn({ email, password, next });
      if (result?.error) setError(result.error);
    } catch (err) {
      unstable_rethrow(err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <FieldGroup>
        <AuthEmailField value={email} onChange={setEmail} />
        <AuthPasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <AuthAltLink
          prompt="Forgot your password?"
          linkText="Reset it"
          to="/forgot-password"
          next={next}
        />
        {error && <FieldError>{error}</FieldError>}
        <AuthSubmitButton pending={loading} label="Sign In" pendingLabel="Signing in…" />
        <AuthAltLink
          prompt="New here?"
          linkText="Create an account"
          to="/register"
          next={next}
        />
      </FieldGroup>
    </form>
  );
}
