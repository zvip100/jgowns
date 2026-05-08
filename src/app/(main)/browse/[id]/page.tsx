import { createClient } from "@/lib/supabase/server";
import { browseHrefFromBackParam } from "@/lib/browse-params";
import { GOWN_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; from?: string }>;
}) {
  const [{ id }, { back, from }] = await Promise.all([params, searchParams]);

  const fromDashboard = from === 'dash';
  const backHref = fromDashboard ? '/dashboard' : browseHrefFromBackParam(back);
  const backLabel = fromDashboard ? 'Back to dashboard' : 'Browse all gowns';

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();
  if (!listing) notFound();

  const categoryLabel =
    listing.category &&
    (GOWN_CATEGORIES.find((c) => c.id === listing.category)?.label ??
      String(listing.category));

  const sold = listing.status === 'sold';

  return (
    <div className='mx-auto max-w-5xl'>
      <Link
        href={backHref}
        className='mb-6 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:text-[#5a4537]'
      >
        ← {backLabel}
      </Link>

      <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12'>
        <div className='relative aspect-3/4 overflow-hidden rounded-[1.7rem] bg-[#efe7dc]'>
          {listing.image_url ? (
            <Image
              src={listing.image_url}
              alt={listing.title}
              fill
              sizes='(max-width: 768px) 100vw, 56vw'
              className='object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center text-8xl text-[#bca88f]'>
              👗
            </div>
          )}
          {listing.status === 'sold' && (
            <>
              <div
                aria-hidden
                className='pointer-events-none absolute inset-0 bg-linear-to-br from-(--ink)/35 via-(--ink)/15 to-transparent'
              />
              <div
                role='status'
                aria-label='This gown has been sold'
                className='pointer-events-none absolute -left-16 top-10 w-64 -rotate-45 border-y border-white/20 bg-(--sold) py-2.5 text-center text-sm font-semibold uppercase tracking-[0.5em] text-white shadow-[0_18px_36px_rgba(120,20,40,0.4)]'
              >
                Sold
              </div>
            </>
          )}
        </div>

        <div className='flex flex-col py-2'>
          {listing.color && (
            <span className='mb-3 inline-flex w-fit rounded-full border border-[#decdb8] bg-[#fff9f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7b634b]'>
              {listing.color}
            </span>
          )}
          <h1 className='text-[1.9rem] text-[#2f241b] sm:text-4xl'>
            {listing.title}
          </h1>
          <p className='mt-3 font-display text-[2.6rem] leading-none text-[#8a6232]'>
            ${listing.price.toLocaleString()}
          </p>

          <div className='soft-divider my-5' />

          <dl className='space-y-2.5'>
            <div className='flex gap-3'>
              <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                Size
              </dt>
              <dd className='text-sm font-medium text-[#3f3025]'>
                {listing.size}
              </dd>
            </div>
            {categoryLabel && (
              <div className='flex gap-3'>
                <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                  Category
                </dt>
                <dd className='text-sm font-medium text-[#3f3025]'>
                  {categoryLabel}
                </dd>
              </div>
            )}
            {listing.location && (
              <div className='flex gap-3'>
                <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                  Location
                </dt>
                <dd className='text-sm font-medium text-[#3f3025]'>
                  {listing.location}
                </dd>
              </div>
            )}
            <div className='flex gap-3'>
              <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                Condition
              </dt>
              <dd className='text-sm font-medium text-[#3f3025]'>
                {listing.condition}
              </dd>
            </div>
            <div className='flex gap-3'>
              <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                Listed
              </dt>
              <dd className='text-sm text-[#7d6652]'>
                {new Date(listing.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>

          {listing.description && (
            <>
              <div className='soft-divider my-5' />
              <div>
                <p className='mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                  About this gown
                </p>
                <p className='text-sm leading-relaxed text-[#5d4b3d]'>
                  {listing.description}
                </p>
              </div>
            </>
          )}

          <div className='soft-divider my-5' />

          <div className='surface-panel hairline flex flex-col gap-3 rounded-2xl p-5'>
            <p className='text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462]'>
              {sold ? 'No longer available' : 'Contact the Seller'}
            </p>
            <a
              href={sold ? undefined : `mailto:${listing.contact_email}`}
              aria-disabled={sold || undefined}
              tabIndex={sold ? -1 : undefined}
              aria-label='Email the seller'
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]',
                sold
                  ? 'pointer-events-none opacity-40 grayscale'
                  : 'hover:-translate-y-0.5 hover:brightness-105',
              )}
            >
              ✉️ Email Seller
            </a>
            {listing.contact_phone && (
              <a
                href={sold ? undefined : `tel:${listing.contact_phone}`}
                aria-disabled={sold || undefined}
                tabIndex={sold ? -1 : undefined}
                aria-label='Call the seller'
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-full border border-[#d4c2ad] bg-white/70 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5a4738]',
                  sold ? 'pointer-events-none opacity-40 grayscale' : 'hover:bg-white',
                )}
              >
                📞 Call Seller
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
