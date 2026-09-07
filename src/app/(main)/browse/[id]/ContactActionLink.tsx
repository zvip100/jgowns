'use client';

import { captureEvent } from '@/lib/analytics/client';
import { cn } from '@/lib/utils';

import type { AnalyticsEventName, ListingContactProperties } from '@/lib/analytics/events';
import type { ReactNode } from 'react';

const CONTACT_PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-[#b58d5f]/70 bg-[#b3854c]/12 px-3.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[#8a6232] transition-colors hover:bg-[#b3854c]/20';

type ContactActionLinkProps = {
  href: string;
  label: string;
  eventName: AnalyticsEventName;
  contactProperties: ListingContactProperties;
  sold: boolean;
  children: ReactNode;
};

/**
 * A client leaf purely so the tel/sms/mailto click can be captured. The icon
 * arrives as rendered children, which keeps `ContactPanel` a Server Component:
 * a `LucideIcon` component reference would not cross the boundary.
 */
export function ContactActionLink({
  href,
  label,
  eventName,
  contactProperties,
  sold,
  children,
}: ContactActionLinkProps) {
  return (
    <a
      href={sold ? undefined : href}
      onClick={sold ? undefined : () => captureEvent(eventName, contactProperties)}
      aria-disabled={sold || undefined}
      tabIndex={sold ? -1 : undefined}
      aria-label={`${label} the seller`}
      className={cn(
        CONTACT_PILL_CLASS,
        sold && 'pointer-events-none opacity-40 grayscale',
      )}
    >
      {children}
      {label}
    </a>
  );
}
