'use client';

import Link from 'next/link';

import { withPostAuthPath } from '@/lib/auth-redirect';
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

const AUTH_SUBMIT_CLASS =
  'w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50';

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
