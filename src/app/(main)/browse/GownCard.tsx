import Image from "next/image";
import Link from "next/link";
import { Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  availableSizes,
  listingPriceSummary,
  sortListingSizes,
} from "@/lib/listing-variants";
import { blurProps } from "@/lib/utils";

import type { ListingWithSizes, SizeGroupSlug } from "@/lib/types";

type GownCardProps = {
  listing: ListingWithSizes;
  /** Filter query only (e.g. `category=bridal`); omit when no filters. */
  backQuery?: string;
  /** Active size filters — matching sizes are highlighted in the summary. */
  matchedSizePairs?: { sizeGroup: SizeGroupSlug; size: string }[];
};

export default function GownCard({
  listing,
  backQuery,
  matchedSizePairs,
}: GownCardProps) {
  const sizes = sortListingSizes(availableSizes(listing.sizes));
  const matchedKeys = new Set(
    (matchedSizePairs ?? []).map((p) => `${p.sizeGroup}:${p.size}`),
  );
  const href = backQuery
    ? `/browse/${listing.id}?back=${encodeURIComponent(backQuery)}`
    : `/browse/${listing.id}`;

  return (
    <Link href={href} className='group block'>
      <Card className='surface-panel hairline gap-0 overflow-hidden rounded-3xl bg-transparent p-0 py-0 text-card-foreground ring-0'>
        <div className='relative aspect-3/4 overflow-hidden bg-[#efe7dc]'>
          <Image
            src={listing.image_urls[0]}
            alt={listing.title}
            fill
            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 56vw, 30vw'
            className='object-cover transition duration-500 group-hover:scale-[1.045]'
            {...blurProps(listing.image_blur_data_urls[0])}
          />
          {listing.color && (
            <Badge
              variant='outline'
              className='absolute left-4 top-4 h-auto rounded-full border-white/80 bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[#7e644b] backdrop-blur-md'
            >
              {listing.color}
            </Badge>
          )}
          {sizes.length > 1 && (
            <Badge
              variant='outline'
              aria-label={`${sizes.length} sizes available`}
              className='absolute right-4 top-4 h-auto gap-1 rounded-full border-white/80 bg-white/70 px-2.5 py-1 text-[0.72rem] font-semibold text-[#7e644b] backdrop-blur-md'
            >
              <Layers className='size-3 shrink-0' aria-hidden />
              {sizes.length}
            </Badge>
          )}
        </div>
        <CardContent className='space-y-2 p-4 sm:p-5'>
          <h3 className='font-display truncate text-[1rem] text-[#3f3025] sm:text-[1.25rem]'>
            {listing.title}
          </h3>
          <div className='flex items-center justify-between gap-3 text-xs sm:text-sm'>
            <span className='min-w-0 truncate text-[#7d6652]'>
              {sizes.length === 1 ? "Size " : "Sizes "}
              {sizes.map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ", " : ""}
                  <span
                    className={
                      matchedKeys.has(`${s.size_group}:${s.size}`)
                        ? "font-semibold text-[#5a4537]"
                        : undefined
                    }
                  >
                    {s.size}
                  </span>
                </span>
              ))}
              {listing.location ? ` · ${listing.location}` : ""}
            </span>
            <span className='shrink-0 text-base font-semibold text-[#8a6232] sm:text-lg'>
              {listingPriceSummary(listing)}
            </span>
          </div>
          {listing.condition && (
            <Badge
              variant='outline'
              className='h-auto rounded-full border-[#decdb8] bg-[#fff9f0] px-2.5 py-1 text-xs font-medium tracking-normal normal-case text-[#7b634b]'
            >
              {listing.condition}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
