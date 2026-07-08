import Image from 'next/image';
import Link from 'next/link';
import { Eye, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MarkSizeSoldButton from '@/components/MarkSizeSoldButton';
import MarkSoldButton from '@/components/MarkSoldButton';
import RemoveListingButton from '@/components/RemoveListingButton';
import { sortListingSizes } from '@/lib/listing-variants';
import { blurProps } from '@/lib/utils';
import { GOWN_CATEGORIES, type Listing, type ListingWithSizes } from '@/lib/types';

const statusStyles: Record<Listing['status'], string> = {
  active: 'bg-[#e8f4ec] text-[#2d7a4f]',
  sold: 'bg-(--sold) text-white',
  removed: 'bg-[#fef4e0] text-[#8a6a30]',
};

export default function ListingRow({
  listing,
}: {
  listing: ListingWithSizes;
}) {
  const sizes = sortListingSizes(listing.sizes);
  const isSetOnly = listing.sell_mode === 'set_only';
  const showPerSizeSold =
    listing.status === 'active' && !isSetOnly && sizes.length > 1;
  const category = GOWN_CATEGORIES.find((c) => c.id === listing.category)?.label;
  const href = `/browse/${listing.id}?from=dash`;

  return (
    <article className="surface-panel hairline group flex items-center gap-4 rounded-2xl p-3 transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(99,72,40,0.14)] sm:gap-5 sm:p-4">
      <Link href={href} className="shrink-0">
        <div className="relative aspect-4/5 w-20 overflow-hidden rounded-xl bg-(--bg-ivory) sm:w-24">
          <Image
            src={listing.image_urls[0]}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 96px, 112px"
            className="object-cover transition duration-500 group-hover:scale-105"
            {...blurProps(listing.image_blur_data_urls[0])}
          />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        {category && (
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-(--accent-deep)/80">
            {category}
          </p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="truncate font-display text-base font-medium text-(--ink) sm:text-lg">
            <Link
              href={href}
              className="transition hover:text-(--accent-deep)"
            >
              {listing.title}
            </Link>
          </h3>
          <Badge variant="secondary" className={statusStyles[listing.status]}>
            {listing.status}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--muted-ink)">
          {sizes.map((s) => {
            const sizeSold = s.status === 'sold';
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className={sizeSold ? 'line-through opacity-60' : ''}>
                  Size {s.size}
                  {!isSetOnly && (
                    <>
                      <span className="mx-1.5 text-(--line)">·</span>
                      <span className="font-semibold text-(--ink)">
                        ${s.price.toLocaleString()}
                      </span>
                    </>
                  )}
                </span>
                {showPerSizeSold && !sizeSold && (
                  <MarkSizeSoldButton
                    listingId={listing.id}
                    sizeId={s.id}
                    size={s.size}
                  />
                )}
              </span>
            );
          })}
        </div>
        {listing.bundle_price != null && (
          <p className="mt-1 text-xs text-(--muted-ink)">
            {listing.sell_mode === 'set_only' ? 'Set price' : 'Bundle price'}{' '}
            <span className="font-semibold text-(--ink)">
              ${listing.bundle_price.toLocaleString()}
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <MarkSoldButton
          id={listing.id}
          status={listing.status}
          hasMultipleSizes={sizes.length > 1}
        />
        <RemoveListingButton id={listing.id} />
        <Button asChild variant="ghost" size="sm">
          <Link href={href} aria-label="View listing">
            <Eye data-icon="inline-start" />
            <span className="hidden sm:inline">View</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/edit/${listing.id}`} aria-label="Edit listing">
            <Pencil data-icon="inline-start" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
        </Button>
      </div>
    </article>
  );
}
