'use client';

import Link from 'next/link';

import { captureEvent } from '@/lib/analytics/client';
import { SELLER_EVENTS } from '@/lib/analytics/events';

import type { ReactNode } from 'react';

/** The four surfaces that send a seller to `/dashboard/new` (spec §5.2). */
export type SellCtaPlacement =
  | 'home_sell_section'
  | 'nav'
  | 'dashboard'
  | 'footer';

type SellCtaLinkProps = {
  placement: SellCtaPlacement;
  className?: string;
  prefetch?: boolean;
  children: ReactNode;
};

/**
 * A client leaf shared by all four CTAs, so the capture lives in one place and
 * each Server Component parent stays a Server Component.
 */
export function SellCtaLink({
  placement,
  className,
  prefetch,
  children,
}: SellCtaLinkProps) {
  return (
    <Link
      href="/dashboard/new"
      className={className}
      prefetch={prefetch}
      onClick={() => captureEvent(SELLER_EVENTS.sellCtaClicked, { placement })}
    >
      {children}
    </Link>
  );
}
