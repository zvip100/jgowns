import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Listing } from "@/lib/types";

export default function GownCard({
  listing,
  backQuery,
}: {
  listing: Listing;
  /** Filter query only (e.g. `category=bride`); omit when no filters. */
  backQuery?: string;
}) {
  const href = backQuery
    ? `/browse/${listing.id}?back=${encodeURIComponent(backQuery)}`
    : `/browse/${listing.id}`;

  return (
    <Link href={href} className='group block'>
      <Card className='surface-panel hairline gap-0 overflow-hidden rounded-3xl bg-transparent p-0 py-0 text-card-foreground ring-0'>
        <div className='relative aspect-3/4 overflow-hidden bg-[#efe7dc]'>
          <Image
            src={listing.image_url}
            alt={listing.title}
            fill
            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 56vw, 30vw'
            className='object-cover transition duration-500 group-hover:scale-[1.045]'
            {...(listing.image_blur_data_url
              ? { placeholder: 'blur' as const, blurDataURL: listing.image_blur_data_url }
              : {})}
          />
          {listing.color && (
            <Badge
              variant='outline'
              className='absolute left-4 top-4 h-auto rounded-full border-white/80 bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[#7e644b] backdrop-blur-md'
            >
              {listing.color}
            </Badge>
          )}
        </div>
        <CardContent className='space-y-2 p-4 sm:p-5'>
          <h3 className='font-display truncate text-[1rem] text-[#3f3025] sm:text-[1.25rem]'>
            {listing.title}
          </h3>
          <div className='flex items-center justify-between text-xs sm:text-sm'>
            <span className='text-[#7d6652]'>
              Size {listing.size}
              {listing.location ? ` · ${listing.location}` : ""}
            </span>
            <span className='text-base font-semibold text-[#8a6232] sm:text-lg'>
              ${listing.price.toLocaleString()}
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
