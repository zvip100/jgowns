import { Suspense } from 'react';

import { getListingFeeCents, isListingFeeActive } from '@/lib/listing-fee';
import { getCurrentUser, getSessionContact } from '@/lib/queries/auth';
import ListingForm from '@/components/ListingForm';

import ListingAgreementGate from './ListingAgreementGate';
import ListingFormSkeleton from './ListingFormSkeleton';

import type { Metadata } from 'next';
import type { ListingFormData } from '@/lib/types';

export const metadata: Metadata = {
  title: "List a Gown",
  description: "Create a new listing to sell your pre-loved modest gown.",
};

async function PrefilledListingForm() {
  const [contact, user] = await Promise.all([
    getSessionContact(),
    getCurrentUser(),
  ]);
  const initial: Partial<ListingFormData> = {
    contact_email: contact?.email ?? '',
    contact_phone: contact?.phone ?? '',
  };
  const isFeeActive = isListingFeeActive();
  const listingFeeCents = isFeeActive ? getListingFeeCents() : undefined;

  return (
    <ListingForm
      initial={initial}
      listingFeeCents={listingFeeCents}
      isFeeWaivable={isFeeActive && Boolean(user?.isAdmin)}
    />
  );
}

export default function NewListingPage() {
  return (
    <div>
      <div className='mb-8 text-center sm:mb-10'>
        <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>List Your Gown</h1>
        <p className='mt-2 text-sm text-[#7d6652]'>Connect directly with buyers looking for exactly this</p>
      </div>
      <ListingAgreementGate>
        <Suspense fallback={<ListingFormSkeleton />}>
          <PrefilledListingForm />
        </Suspense>
      </ListingAgreementGate>
    </div>
  );
}
