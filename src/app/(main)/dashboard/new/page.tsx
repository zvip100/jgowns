import ListingForm from '@/components/ListingForm';

export default function NewListingPage() {
  return (
    <div>
      <div className='mb-8 text-center sm:mb-10'>
        <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>List Your Gown</h1>
        <p className='mt-2 text-sm text-[#7d6652]'>Connect directly with buyers looking for exactly this</p>
      </div>
      <ListingForm />
    </div>
  );
}
