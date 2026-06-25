import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ListingsGridWrap from "@/components/ListingsGridWrap";

const STAGGER = [
  {
    card: "[animation-delay:0ms]",
    title: "[animation-delay:60ms]",
    meta: "[animation-delay:90ms]",
    price: "[animation-delay:120ms]",
  },
  {
    card: "[animation-delay:100ms]",
    title: "[animation-delay:160ms]",
    meta: "[animation-delay:190ms]",
    price: "[animation-delay:220ms]",
  },
  {
    card: "[animation-delay:200ms]",
    title: "[animation-delay:260ms]",
    meta: "[animation-delay:290ms]",
    price: "[animation-delay:320ms]",
  },
  {
    card: "[animation-delay:300ms]",
    title: "[animation-delay:360ms]",
    meta: "[animation-delay:390ms]",
    price: "[animation-delay:420ms]",
  },
] as const;

export default function ListingsSkeleton() {
  return (
    <>
      <div className='mb-4 flex justify-end' aria-hidden>
        <Skeleton className='skeleton-shimmer h-4 w-32 animate-none rounded-full bg-transparent sm:h-4.5 sm:w-36' />
      </div>

      <div>
        <ListingsGridWrap>
          {STAGGER.map((delays, i) => (
            <Card
              key={i}
              className={`surface-panel hairline gap-0 overflow-hidden rounded-3xl bg-transparent p-0 py-0 ring-0 ${delays.card}`}
            >
              <Skeleton
                className={`skeleton-shimmer aspect-3/4 w-full animate-none rounded-none bg-transparent ${delays.card}`}
              />
              <CardContent className='space-y-2.5 bg-[#efe7dc]/40 p-4 sm:p-5'>
                <Skeleton
                  className={`skeleton-shimmer h-4 w-4/5 animate-none rounded-full bg-transparent ${delays.title}`}
                />
                <Skeleton
                  className={`skeleton-shimmer h-3 w-1/2 animate-none rounded-full bg-transparent ${delays.meta}`}
                />
                <Skeleton
                  className={`skeleton-shimmer mt-1 h-5 w-2/5 animate-none rounded-full bg-transparent ${delays.price}`}
                />
              </CardContent>
            </Card>
          ))}
        </ListingsGridWrap>

        <p
          className='mt-8 text-center text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#b09d8c]'
          aria-live='polite'
          aria-label='Loading gowns'
        >
          Discovering gowns for you
          <span className='ml-1 inline-flex gap-0.5'>
            <span className='animate-bounce [animation-delay:0ms]'>·</span>
            <span className='animate-bounce [animation-delay:150ms]'>·</span>
            <span className='animate-bounce [animation-delay:300ms]'>·</span>
          </span>
        </p>
      </div>
    </>
  );
}
