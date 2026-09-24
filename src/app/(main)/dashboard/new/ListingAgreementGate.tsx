'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';

import NoticePanel from '@/components/NoticePanel';
import { ListingCreatedContext } from '@/hooks/useListingFormSubmit';
import { NOTICE_PANEL_PRIMARY_ACTION_CLASS } from '@/lib/styles';

import type { ReactNode } from 'react';

type ListingAgreementGateProps = {
  children: ReactNode;
};

const LISTING_STANDARDS = [
  { lead: 'Modest photos only.', detail: 'Every photo must meet these standards.' },
  { lead: 'Crop couple photos.', detail: 'Remove the other person so only the gown shows.' },
];

export default function ListingAgreementGate({ children }: ListingAgreementGateProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const hasCreatedRef = useRef(false);
  const markCreated = useCallback(() => {
    hasCreatedRef.current = true;
  }, []);

  // Start fresh after a create, whether Activity hides this route (client
  // redirect) or the browser restores it from bfcache (Back from Stripe).
  useLayoutEffect(() => {
    const resetIfCreated = () => {
      if (!hasCreatedRef.current) return;
      hasCreatedRef.current = false;
      setHasAgreed(false);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) resetIfCreated();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      resetIfCreated();
    };
  }, []);

  if (!hasAgreed) {
    return (
      <NoticePanel
        icon={ShieldCheck}
        title='Our Listing Standards'
        description='JGowns follows the standards of Jewish modesty.'
        className='mt-0 sm:mt-0'
        primaryAction={
          <button
            type='button'
            className={NOTICE_PANEL_PRIMARY_ACTION_CLASS}
            onClick={() => setHasAgreed(true)}
          >
            I Agree
          </button>
        }
        footnote="JGowns may edit or remove any photo or listing that doesn't match our values."
      >
        <ul className='mt-5 grid gap-2.5 text-left'>
          {LISTING_STANDARDS.map(({ lead, detail }) => (
            <li key={lead} className='flex gap-2.5 text-sm text-(--muted-ink)'>
              <Check className='mt-0.5 size-4 shrink-0 text-accent' aria-hidden />
              <span>
                <span className='font-semibold text-(--ink)'>{lead}</span> {detail}
              </span>
            </li>
          ))}
        </ul>
      </NoticePanel>
    );
  }

  return <ListingCreatedContext value={markCreated}>{children}</ListingCreatedContext>;
}
