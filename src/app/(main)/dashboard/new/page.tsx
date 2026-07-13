import type { Metadata } from 'next';

import { getSessionContact } from '@/lib/queries/auth';
import ListingForm from '@/components/ListingForm';

import type { ListingFormData } from '@/lib/types';

export const metadata: Metadata = {
  title: "List a Gown",
  description: "Create a new listing to sell your pre-loved modest gown.",
};

export default async function NewListingPage() {
  const contact = await getSessionContact();
  const initial: Partial<ListingFormData> = {
    contact_email: contact?.email ?? '',
    contact_phone: contact?.phone ?? '',
  };

  return (
    <div>
      <div className='mb-8 text-center sm:mb-10'>
        <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>List Your Gown</h1>
        <p className='mt-2 text-sm text-[#7d6652]'>Connect directly with buyers looking for exactly this</p>
      </div>
      <ListingForm initial={initial} />
    </div>
  );
}
