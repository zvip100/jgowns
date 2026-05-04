import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Listing } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: listings } = await supabase.from('listings').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });

  return (
    <div>
      <div className='mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10'>
        <div>
          <h1 className='text-[2rem] text-[#2f241b] sm:text-[2.35rem]'>My Listings</h1>
          <p className='mt-1 text-sm text-[#6f5d4d]'>Manage and track your gowns</p>
        </div>
        <Link
          href='/dashboard/new'
          className='inline-flex items-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
        >
          + New Listing
        </Link>
      </div>
      {!listings?.length ? (
        <div className='surface-panel hairline rounded-[1.8rem] py-20 text-center text-[#8e7962]'>
          <div className='mb-4 text-6xl'>👗</div>
          <p className='mb-5 text-base'>You haven’t listed any gowns yet.</p>
          <Link href='/dashboard/new' className='font-semibold text-[#a0733f] hover:text-[#8e6330]'>
            List your first gown →
          </Link>
        </div>
      ) : (
        <div className='space-y-3'>
          {listings.map((l: Listing) => (
            <div key={l.id} className='surface-panel hairline flex items-center gap-4 rounded-2xl p-4 sm:gap-5 sm:p-5'>
              <div className='h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[#efe7dc]'>
                {l.image_url
                  ? <img src={l.image_url} alt={l.title} className='h-full w-full object-cover' />
                  : <div className='flex h-full w-full items-center justify-center text-2xl'>👗</div>
                }
              </div>
              <div className='min-w-0 flex-1'>
                <h3 className='truncate font-semibold text-[#31261d]'>{l.title}</h3>
                <p className='mt-0.5 text-sm text-[#7d6652]'>Size {l.size} · ${l.price.toLocaleString()}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  l.status === 'active' ? 'bg-[#e8f4ec] text-[#2d7a4f]' :
                  l.status === 'sold' ? 'bg-[#ede9e4] text-[#7a6a5b]' : 'bg-[#fef4e0] text-[#8a6a30]'
                }`}>{l.status}</span>
              </div>
              <div className='flex shrink-0 flex-col gap-2 sm:flex-row'>
                <Link href={`/browse/${l.id}`} className='text-xs font-semibold uppercase tracking-[0.1em] text-[#a0733f] hover:text-[#8e6330]'>View</Link>
                <Link href={`/dashboard/edit/${l.id}`} className='text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7462] hover:text-[#5a4537]'>Edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
