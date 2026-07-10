import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { sortListingSizes } from '@/lib/listing-variants';
import { isValidUUID } from '@/lib/utils';
import ListingForm from '@/components/ListingForm';

import type { ListingFormData, ListingWithSizes } from '@/lib/types';

export const metadata: Metadata = {
  title: "Edit Listing",
  description: "Update your gown listing details.",
  robots: { index: false, follow: false },
};

type EditListingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;
  if (!isValidUUID(id)) notFound();
  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('*, sizes:listing_sizes(*)')
    .eq('id', id)
    .single();
  if (!data) notFound();

  const listingWithSizes = data as ListingWithSizes;
  const initial: Partial<ListingFormData> = {
    ...listingWithSizes,
    sizes: sortListingSizes(listingWithSizes.sizes).map(
      ({ size, size_group, price }) => ({ size, size_group, price }),
    ),
  };

  return (
    <div>
      <div className='mb-8 text-center sm:mb-10'>
        <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>Edit Listing</h1>
        <p className='mt-2 text-sm text-[#7d6652]'>Update your gown details</p>
      </div>
      <ListingForm initial={initial} listingId={id} />
    </div>
  );
}
