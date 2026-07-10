'use client';

import { useState, useLayoutEffect } from 'react';
import { unstable_rethrow } from 'next/navigation';

import { updatePassword } from '@/lib/actions/auth';
import { FieldError, FieldGroup } from '@/components/ui/field';

import { AuthAltLink, AuthPasswordField, AuthSubmitButton } from '../auth-form';

type ResetPasswordFormProps = { next: string };

export default function ResetPasswordForm({ next }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    return () => setError('');
  }, []);

  const handleUpdate = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await updatePassword({ password, next });
      if (result?.error) setError(result.error);
    } catch (err) {
      unstable_rethrow(err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
      <FieldGroup>
        <AuthPasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error && <FieldError>{error}</FieldError>}
        <AuthSubmitButton pending={loading} label="Save Password" pendingLabel="Saving…" />
        <AuthAltLink
          prompt="Link expired?"
          linkText="Request a new one"
          to="/forgot-password"
          next={next}
        />
      </FieldGroup>
    </form>
  );
}
