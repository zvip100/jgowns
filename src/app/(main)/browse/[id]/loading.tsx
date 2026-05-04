// Pre-built per-row delay class pairs so Tailwind's JIT extracts every value.
const ROW_DELAYS = [
  { label: "[animation-delay:160ms]", value: "[animation-delay:180ms]" },
  { label: "[animation-delay:190ms]", value: "[animation-delay:210ms]" },
  { label: "[animation-delay:220ms]", value: "[animation-delay:240ms]" },
  { label: "[animation-delay:250ms]", value: "[animation-delay:270ms]" },
] as const;

export default function ListingPageSkeleton() {
  return (
    <div className='mx-auto max-w-5xl'>
      {/* Back link */}
      <div className='skeleton-shimmer mb-6 h-4 w-36 rounded-full' />

      <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12'>
        {/* Image */}
        <div className='skeleton-shimmer aspect-3/4 w-full rounded-[1.7rem] [animation-delay:60ms]' />

        {/* Detail column */}
        <div className='flex flex-col py-2'>
          {/* Color badge */}
          <div className='skeleton-shimmer mb-3 h-6 w-20 rounded-full [animation-delay:80ms]' />

          {/* Title */}
          <div className='skeleton-shimmer mb-2 h-9 w-3/4 rounded-2xl [animation-delay:100ms]' />
          <div className='skeleton-shimmer h-9 w-1/2 rounded-2xl [animation-delay:120ms]' />

          {/* Price */}
          <div className='skeleton-shimmer mt-4 h-12 w-32 rounded-2xl [animation-delay:140ms]' />

          <div className='soft-divider my-5' />

          {/* dl rows: Size, Location, Condition, Listed */}
          <div className='space-y-4'>
            {ROW_DELAYS.map((delays, i) => (
              <div key={i} className='flex gap-3'>
                <div
                  className={`skeleton-shimmer h-3 w-16 shrink-0 rounded-full ${delays.label}`}
                />
                <div
                  className={`skeleton-shimmer h-3 w-28 rounded-full ${delays.value}`}
                />
              </div>
            ))}
          </div>

          <div className='soft-divider my-5' />

          {/* Contact panel */}
          <div className='surface-panel hairline space-y-3 rounded-2xl p-5'>
            <div className='skeleton-shimmer h-3 w-28 rounded-full [animation-delay:300ms]' />
            <div className='skeleton-shimmer h-11 w-full rounded-full [animation-delay:330ms]' />
            <div className='skeleton-shimmer h-11 w-full rounded-full [animation-delay:360ms]' />
          </div>
        </div>
      </div>
    </div>
  );
}
