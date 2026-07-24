'use client';

import { useEffect } from 'react';

import { toast } from '@/lib/toast';

/** Maps the one-shot `?toast=` flag (set by a redirecting server action) to a
 * confirmation message. Read from the URL and stripped on mount so a refresh
 * never re-fires it. */
const FLASH_MESSAGES: Record<string, string> = {
  'listing-updated': 'Changes saved',
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

    const message = FLASH_MESSAGES[key];
    if (message) toast.success(message);
  }, []);

  return null;
}
