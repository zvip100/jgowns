import Link from "next/link";
import { ChevronLeft, Mail, Phone } from "lucide-react";

import {
  formatPrice,
  isListingSoldOut,
  listingBundleNote,
  listingPriceSummary,
  sortListingSizes,
} from "@/lib/listing-variants";
import { GOWN_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ImageViewer } from "./ImageViewer";

import type { ListingWithSizes } from "@/lib/types";

type ListingDetailProps = {
  listing: ListingWithSizes;
  backHref: string;
  backLabel: string;
};

export function ListingDetail({
  listing,
  backHref,
  backLabel,
}: ListingDetailProps) {
  const categoryLabel =
    listing.category &&
    (GOWN_CATEGORIES.find((c) => c.id === listing.category)?.label ??
      String(listing.category));

  const sold = isListingSoldOut(listing);
  const sizes = sortListingSizes(listing.sizes);
  const isSetOnly = listing.sell_mode === 'set_only';
  const showSizeTable = !isSetOnly && sizes.length > 1;
  const bundleNote = listingBundleNote(listing);
  const setPrice =
    listing.sell_mode === 'either' && bundleNote && listing.bundle_price != null
      ? formatPrice(listing.bundle_price)
      : null;

  return (
    <div className='mx-auto max-w-5xl'>
      <Link
        href={backHref}
        prefetch={true}
        className='mb-6 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:text-[#5a4537]'
      >
        <ChevronLeft data-icon='inline-start' />
        {backLabel}
      </Link>

      <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12'>
        <ImageViewer
          imageUrls={listing.image_urls}
          blurDataUrls={listing.image_blur_data_urls}
          title={listing.title}
          isSold={sold}
        />

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
            {listingPriceSummary(listing)}
          </p>
          {isSetOnly && (
            <p className='mt-2 text-sm text-[#7d6652]'>
              Sold as a set of {sizes.length} gowns — not available
              individually.
            </p>
          )}
          {setPrice && (
            <p className='mt-2 text-sm text-[#7d6652]'>
              Or {setPrice} for the complete set.
            </p>
          )}

          <div className='soft-divider my-5' />

          {showSizeTable && (
            <div className='mb-5 overflow-hidden rounded-2xl border border-[#e7dccb]'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-[#fff9f0] text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                    <th className='px-4 py-2 text-left font-semibold'>Size</th>
                    <th className='px-4 py-2 text-right font-semibold'>
                      Price
                    </th>
                    <th className='px-4 py-2 text-right font-semibold'>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((s) => {
                    const sizeSold = s.status === 'sold';
                    return (
                      <tr key={s.id} className='border-t border-[#f0e7d8]'>
                        <td className='px-4 py-2.5 font-medium text-[#3f3025]'>
                          {s.size}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-medium',
                            sizeSold
                              ? 'text-[#b3a18c] line-through'
                              : 'text-[#8a6232]',
                          )}
                        >
                          {formatPrice(s.price)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-widest',
                            sizeSold ? 'text-[#b3a18c]' : 'text-[#2d7a4f]',
                          )}
                        >
                          {sizeSold ? 'Sold' : 'Available'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <dl className='space-y-2.5'>
            {sizes.length > 1 && (
              <div className='flex gap-3'>
                <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                  Total
                </dt>
                <dd className='text-sm font-medium text-[#3f3025]'>
                  {sizes.length} gowns
                </dd>
              </div>
            )}
            {!showSizeTable && (
              <div className='flex gap-3'>
                <dt className='w-20 shrink-0 pt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462]'>
                  {sizes.length === 1 ? 'Size' : 'Sizes'}
                </dt>
                <dd className='text-sm font-medium text-[#3f3025]'>
                  {sizes.map((s) => s.size).join(', ')}
                </dd>
              </div>
            )}
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
                'flex w-full items-center justify-center gap-2 rounded-full border border-[#b58d5f]/70 gold-gradient py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]',
                sold
                  ? 'pointer-events-none opacity-40 grayscale'
                  : 'hover:-translate-y-0.5 hover:brightness-105',
              )}
            >
              <Mail data-icon='inline-start' className='size-3.5 shrink-0' />
              Email Seller
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
                <Phone data-icon='inline-start' className='size-3.5 shrink-0' />
                Call Seller
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
