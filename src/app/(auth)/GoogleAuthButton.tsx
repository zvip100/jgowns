'use client';

import { useActionState } from 'react';
import { signInWithGoogle, type GoogleAuthState } from '@/lib/actions/auth';
import { FieldError } from '@/components/ui/field';

const INITIAL_STATE: GoogleAuthState = { error: null };

type GoogleIconProps = {
  className?: string;
};

function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

type GoogleAuthButtonProps = { next: string };

export default function GoogleAuthButton({ next }: GoogleAuthButtonProps) {
  const [state, formAction, isPending] = useActionState(
    signInWithGoogle,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[#d8c9b5] bg-white py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5a4a3a] shadow-[0_8px_20px_rgba(106,74,39,0.12)] hover:-translate-y-0.5 hover:bg-[#faf6ef] disabled:translate-y-0 disabled:opacity-50"
      >
        <GoogleIcon className="h-4 w-4" />
        {isPending ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {state.error && <FieldError>{state.error}</FieldError>}
    </form>
  );
}
