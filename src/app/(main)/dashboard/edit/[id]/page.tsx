import { createClient } from '@/lib/supabase/server';
import ListingForm from '@/components/ListingForm';
import { notFound } from 'next/navigation';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).single();
  if (!listing) notFound();

  return (
    <div>
      <div className='mb-8 text-center sm:mb-10'>
        <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>Edit Listing</h1>
        <p className='mt-2 text-sm text-[#7d6652]'>Update your gown details</p>
      </div>
      <ListingForm initial={listing} listingId={id} />
    </div>
  );
}
