'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';

import {
  AUTH_SIGN_IN_ERROR_MESSAGES,
  authErrorReasonFromHash,
} from '@/lib/auth-redirect';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AuthErrorBannerProps = { initialMessage?: string };

/**
 * Upgrades the server-rendered `?error=` message once the client can read a
 * fragment-only reason (see `authErrorReasonFromHash`), then cleans the URL so a
 * refresh or share keeps showing the right message instead of Supabase's raw hash.
 */
export default function AuthErrorBanner({ initialMessage }: AuthErrorBannerProps) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    const reason = authErrorReasonFromHash(window.location.hash);
    if (!reason) return;

    setMessage(AUTH_SIGN_IN_ERROR_MESSAGES[reason]);

    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.set('error', reason);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  if (!message) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription className="text-pretty">{message}</AlertDescription>
    </Alert>
  );
}
