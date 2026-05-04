import { createClient } from "@/lib/supabase/server";
import { browseHrefFromBackParam } from "@/lib/browse-params";
import { GOWN_CATEGORIES } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const [{ id }, { back }] = await Promise.all([params, searchParams]);
  const browseAllHref = browseHrefFromBackParam(back);

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

  return (
    <div className='mx-auto max-w-5xl'>
      <Link
        href={browseAllHref}
        className='mb-6 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:text-[#5a4537]'
      >
        ← Browse all gowns
      </Link>

      <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12'>
        <div className='aspect-3/4 overflow-hidden rounded-[1.7rem] bg-[#efe7dc]'>
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center text-8xl text-[#bca88f]'>
              👗
            </div>
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

          <div className='surface-panel hairline space-y-3 rounded-2xl p-5'>
            <p className='text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a7462]'>
              Contact the Seller
            </p>
            <a
              href={`mailto:${listing.contact_email}`}
              aria-label='Email the seller'
              className='flex w-full items-center justify-center gap-2 rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
            >
              ✉️ Email Seller
            </a>
            {listing.contact_phone && (
              <a
                href={`tel:${listing.contact_phone}`}
                aria-label='Call the seller'
                className='flex w-full items-center justify-center gap-2 rounded-full border border-[#d4c2ad] bg-white/70 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5a4738] hover:bg-white'
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
