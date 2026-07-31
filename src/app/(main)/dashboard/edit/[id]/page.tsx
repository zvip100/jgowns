import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CreditCard, Lock } from 'lucide-react';

import { FormInfoBanner } from '@/components/form/FormInfoBanner';
import ListingForm from '@/components/ListingForm';
import NoticePanel from '@/components/NoticePanel';
import { getCurrentUser } from '@/lib/queries/auth';
import { sortListingSizes } from '@/lib/listing-variants';
import { createClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';

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

  const user = await getCurrentUser();
  if (!user) notFound();

  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('*, sizes:listing_sizes(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .neq('status', 'removed')
    .single();
  if (!data) notFound();

  const listingWithSizes = data as ListingWithSizes;

  if (listingWithSizes.status === 'sold') {
    return (
      <NoticePanel
        icon={Lock}
        title='Listing Sold'
        description='Reactivate this listing from your dashboard to edit it.'
        href='/dashboard'
        linkLabel='Back to dashboard'
      />
    );
  }

  const isPendingPayment = listingWithSizes.status === 'pending_payment';

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
      {isPendingPayment && (
        <div className='mx-auto mb-4 max-w-2xl'>
          <FormInfoBanner icon={CreditCard} className='items-start px-3.5 py-3'>
            <span className='font-semibold'>This listing isn&apos;t live yet.</span>{' '}
            Save your changes, then complete payment from your dashboard.
          </FormInfoBanner>
        </div>
      )}
      <ListingForm initial={initial} listingId={id} />
    </div>
  );
}
