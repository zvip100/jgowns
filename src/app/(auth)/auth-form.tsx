'use client';

import Link from 'next/link';

import { withPostAuthPath } from '@/lib/auth-redirect';
import { PRIMARY_CTA_CLASS } from '@/lib/styles';
import { digitsOnlyPhone } from '@/lib/utils';
import { TextInputField } from '@/components/form/TextInputField';

type AuthFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AuthEmailField({ value, onChange }: AuthFieldProps) {
  return (
    <TextInputField
      id="email"
      label="Email"
      type="email"
      placeholder="example@gmail.com"
      autoComplete="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type AuthPasswordFieldProps = AuthFieldProps & {
  autoComplete: 'current-password' | 'new-password';
};

export function AuthPasswordField({
  value,
  onChange,
  autoComplete,
}: AuthPasswordFieldProps) {
  return (
    <TextInputField
      id="password"
      label="Password"
      type="password"
      placeholder="••••••••"
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function AuthPhoneField({ value, onChange }: AuthFieldProps) {
  return (
    <TextInputField
      id="phone"
      label="Phone (optional)"
      type="tel"
      placeholder="(555) 123-4567"
      autoComplete="tel"
      value={value}
      onChange={(e) => onChange(digitsOnlyPhone(e.target.value))}
    />
  );
}

const AUTH_SUBMIT_CLASS = `${PRIMARY_CTA_CLASS} py-3 disabled:translate-y-0 disabled:opacity-50`;

type AuthSubmitButtonProps = {
  pending: boolean;
  label: string;
  pendingLabel: string;
};

export function AuthSubmitButton({
  pending,
  label,
  pendingLabel,
}: AuthSubmitButtonProps) {
  return (
    <button type="submit" disabled={pending} className={AUTH_SUBMIT_CLASS}>
      {pending ? pendingLabel : label}
    </button>
  );
}

type AuthAltLinkProps = {
  prompt: string;
  linkText: string;
  to: string;
  next: string;
};

export function AuthAltLink({ prompt, linkText, to, next }: AuthAltLinkProps) {
  return (
    <p className="text-center text-sm text-[#7d6652]">
      {prompt}{' '}
      <Link
        href={withPostAuthPath(to, next)}
        className="font-semibold text-[#a0733f] hover:text-[#8e6330]"
      >
        {linkText}
      </Link>
    </p>
  );
}
