import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import {
  formatPrice,
  isListingSoldOut,
  listingBundleNote,
  listingPriceSummary,
  sortListingSizes,
} from "@/lib/listing-variants";
import { GOWN_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ContactPanel } from "./ContactPanel";
import { ImageViewer } from "./ImageViewer";
import { WishlistButton } from "./WishlistButton";

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
          <div className='flex items-start justify-between gap-3'>
            <h1 className='text-[1.9rem] text-[#2f241b] sm:text-4xl'>
              {listing.title}
            </h1>
            <WishlistButton
              listingId={listing.id}
              title={listing.title}
              priceLabel={listingPriceSummary(listing)}
              image={listing.image_urls[0] ?? null}
              blurDataUrl={listing.image_blur_data_urls[0] ?? null}
              status={listing.status === 'sold' ? 'sold' : 'active'}
            />
          </div>
          <p className='mt-3 font-display text-[2.6rem] leading-none text-[#8a6232]'>
            {listingPriceSummary(listing)}
          </p>
          {isSetOnly && (
            <p className='mt-2 text-sm text-[#7d6652]'>
              Sold as a set, not available
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

          <ContactPanel
            contactEmail={listing.contact_email}
            contactPhone={listing.contact_phone}
            contactMethods={listing.contact_methods}
            sold={sold}
          />
        </div>
      </div>
    </div>
  );
}
