import { Suspense } from 'react';
import { TriangleAlert } from 'lucide-react';

import { safeNextPath } from '@/lib/auth-redirect';
import { Alert, AlertDescription } from '@/components/ui/alert';

import GoogleAuthButton from './GoogleAuthButton';

import type { ReactNode } from 'react';

type AuthSearchParams = { next?: string; error?: string };

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth: 'We could not sign you in. Please try again.',
};

type AuthScreenBodyProps = {
  searchParams: Promise<AuthSearchParams>;
  renderForm: (next: string) => ReactNode;
  hasGoogleAuth: boolean;
};

async function AuthScreenBody({
  searchParams,
  renderForm,
  hasGoogleAuth,
}: AuthScreenBodyProps) {
  const { next, error } = await searchParams;
  // Empty means "no destination requested", which is what lets an admin land on
  // /admin by default while still honoring an explicit next=/dashboard.
  const redirectTo = safeNextPath(next) ?? '';
  const errorMessage = error ? AUTH_ERROR_MESSAGES[error] : undefined;

  return (
    <>
      {errorMessage && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {hasGoogleAuth && (
        <>
          <GoogleAuthButton next={redirectTo} />
          <div className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#9a8369]">
            <span className="h-px flex-1 bg-[#e0d4c2]" />
            or
            <span className="h-px flex-1 bg-[#e0d4c2]" />
          </div>
        </>
      )}
      {renderForm(redirectTo)}
    </>
  );
}

type AuthScreenProps = {
  title: string;
  subtitle: string;
  searchParams: Promise<AuthSearchParams>;
  renderForm: (next: string) => ReactNode;
  hasGoogleAuth?: boolean;
};

export default function AuthScreen({
  title,
  subtitle,
  searchParams,
  renderForm,
  hasGoogleAuth = true,
}: AuthScreenProps) {
  return (
    <div className="mx-auto mt-12 max-w-md sm:mt-20">
      <div className="surface-panel hairline stagger-rise rounded-[1.7rem] p-7 sm:p-9">
        <div className="mb-7 text-center">
          <h1 className="text-[2rem] text-[#2f241b]">{title}</h1>
          <p className="mt-2 text-sm text-[#7d6652]">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-5">
          <Suspense fallback={null}>
            <AuthScreenBody
              searchParams={searchParams}
              renderForm={renderForm}
              hasGoogleAuth={hasGoogleAuth}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
