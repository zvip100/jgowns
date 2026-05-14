import { Badge } from "@/components/ui/badge";
import { parseFilters } from "@/lib/listings-data";
import type { PageSearchParams } from "@/lib/types";
import { fetchListings } from "@/lib/listings-queries";

export default async function ListingsCount({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolved = await searchParams;
  const { listings } = await fetchListings(parseFilters(resolved));

  return (
    <Badge
      variant='outline'
      className='h-auto rounded-full border-[#d5c2ad] bg-white/65 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#82684d]'
    >
      {(listings ?? []).length} Active Listings
    </Badge>
  );
}
