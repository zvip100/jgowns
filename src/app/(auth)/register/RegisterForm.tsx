'use client';

import { useState, useLayoutEffect } from 'react';
import { unstable_rethrow } from 'next/navigation';

import { signUp } from '@/lib/actions/auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldError, FieldGroup } from '@/components/ui/field';

import {
  AuthAltLink,
  AuthEmailField,
  AuthPasswordField,
  AuthPhoneField,
  AuthSubmitButton,
} from '../auth-form';

type RegisterFormProps = { next: string };

export default function RegisterForm({ next }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    return () => {
      if (isError) setIsError(false);
      if (msg) setMsg('');
    }
  }, [])

  const handleRegister = async () => {
    setMsg('');
    setIsError(false);
    setLoading(true);
    try {
      const result = await signUp({ email, password, phone, next });
      if ('error' in result) {
        setIsError(true);
        setMsg(result.error);
      } else {
        setIsError(false);
        setMsg(result.message);
      }
    } catch (err) {
      unstable_rethrow(err);
      setIsError(true);
      setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
      <FieldGroup>
        <AuthEmailField value={email} onChange={setEmail} />
        <AuthPasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthPhoneField value={phone} onChange={setPhone} />
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
        <AuthSubmitButton pending={loading} label="Sign Up" pendingLabel="Creating account…" />
        <AuthAltLink
          prompt="Already have an account?"
          linkText="Sign in"
          to="/login"
          next={next}
        />
      </FieldGroup>
    </form>
  );
}
