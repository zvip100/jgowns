'use client';

import { useEffect } from 'react';

import { toast } from '@/lib/toast';

type FlashToast = {
  variant: 'success' | 'error';
  message: string;
  description?: string;
};

/** Maps the one-shot `?toast=` flag (set by a redirecting server action) to a
 * message. Read from the URL and stripped on mount so a refresh never
 * re-fires it. A redirect throws NEXT_REDIRECT, so the action can't return an
 * outcome to the caller: the URL is the only channel back to the client. */
const FLASH_TOASTS: Record<string, FlashToast> = {
  'listing-updated': { variant: 'success', message: 'Changes saved' },
  'checkout-unavailable': {
    variant: 'error',
    message: "Couldn't start checkout",
    description: 'Your listing is saved. Please retry payment.',
  },
};

export function DashboardFlashToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('toast');
    if (!key) return;

    params.delete('toast');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : ''),
    );

    const flash = FLASH_TOASTS[key];
    if (flash) {
      toast[flash.variant](flash.message, { description: flash.description });
    }
  }, []);

  return null;
}
