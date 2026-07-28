import Link from 'next/link';
import { CircleSlash } from 'lucide-react';

import CompletePaymentButton from '@/components/CompletePaymentButton';
import { isValidUUID } from '@/lib/utils';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Payment Canceled",
  description: "Your listing is saved and ready to complete payment.",
  robots: { index: false, follow: false },
};

type CanceledPageProps = {
  searchParams: Promise<{ listing?: string }>;
};

export default async function CheckoutCanceledPage({
  searchParams,
}: CanceledPageProps) {
  const { listing } = await searchParams;
  const listingId = listing && isValidUUID(listing) ? listing : null;

  return (
    <div className='mx-auto mt-16 max-w-md text-center sm:mt-24'>
      <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
        <CircleSlash className='mx-auto mb-4 size-12 text-[#8a7462]' aria-hidden />
        <h2 className='text-[1.6rem] text-[#2f241b]'>Payment canceled</h2>
        <p className='mt-2 text-sm text-[#7d6652]'>
          Your listing is saved. Complete payment anytime from your dashboard to publish your listing.
        </p>
        {listingId && (
          <CompletePaymentButton
            listingId={listingId}
            label='Complete Payment'
            variant='cta'
          />
        )}
        <Link
          href='/dashboard'
          className='mt-4 inline-flex w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] text-(--accent-deep) transition hover:text-[#2f241b]'
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
