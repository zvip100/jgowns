'use client';

import { useState, useLayoutEffect } from 'react';

import { requestPasswordReset } from '@/lib/actions/auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldError, FieldGroup } from '@/components/ui/field';

import { AuthAltLink, AuthEmailField, AuthSubmitButton } from '../auth-form';

type ForgotPasswordFormProps = { next: string };

export default function ForgotPasswordForm({ next }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    return () => {
      setIsError(false);
      setMsg('');
    };
  }, []);

  const handleRequest = async () => {
    setMsg('');
    setIsError(false);
    setLoading(true);
    try {
      const result = await requestPasswordReset({ email });
      if ('error' in result) {
        setIsError(true);
        setMsg(result.error);
      } else {
        setIsError(false);
        setMsg(result.message);
      }
    } catch (err) {
      setIsError(true);
      setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRequest(); }}>
      <FieldGroup>
        <AuthEmailField value={email} onChange={setEmail} />
        {msg && (isError ? (
          <FieldError>{msg}</FieldError>
        ) : (
          <Alert
            className="border-green-200 bg-green-50 text-green-700"
            role="alert"
          >
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        ))}
        <AuthSubmitButton pending={loading} label="Send Reset Link" pendingLabel="Sending…" />
        <AuthAltLink
          prompt="Remember your password?"
          linkText="Sign in"
          to="/login"
          next={next}
        />
      </FieldGroup>
    </form>
  );
}
