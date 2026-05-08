import { Skeleton } from '@/components/ui/skeleton';

const STAT_DELAY = [
  '[animation-delay:0ms]',
  '[animation-delay:80ms]',
  '[animation-delay:160ms]',
  '[animation-delay:240ms]',
] as const;

const ROW_DELAY = [
  '[animation-delay:60ms]',
  '[animation-delay:120ms]',
  '[animation-delay:180ms]',
  '[animation-delay:240ms]',
] as const;

export default function DashboardPageSkeleton() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {STAT_DELAY.map((delay, i) => (
          <div key={i} className="surface-panel hairline rounded-2xl p-4 sm:p-5">
            <Skeleton
              className={`skeleton-shimmer h-3 w-18 animate-none rounded-full bg-transparent ${delay}`}
            />
            <Skeleton
              className={`skeleton-shimmer mt-2 h-8 w-16 animate-none rounded-full bg-transparent ${delay}`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {ROW_DELAY.map((delay, i) => (
          <article
            key={i}
            className="surface-panel hairline flex items-center gap-4 rounded-2xl p-3 sm:gap-5 sm:p-4"
          >
            <Skeleton
              className={`skeleton-shimmer aspect-4/5 w-20 shrink-0 animate-none rounded-xl bg-transparent sm:w-24 ${delay}`}
            />

            <div className="min-w-0 flex-1">
              <Skeleton
                className={`skeleton-shimmer h-2.5 w-20 animate-none rounded-full bg-transparent ${delay}`}
              />
              <Skeleton
                className={`skeleton-shimmer mt-2 h-5 w-2/3 animate-none rounded-full bg-transparent ${delay}`}
              />
              <Skeleton
                className={`skeleton-shimmer mt-2 h-3.5 w-1/2 animate-none rounded-full bg-transparent ${delay}`}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Skeleton
                className={`skeleton-shimmer size-8 animate-none rounded-full bg-transparent ${delay}`}
              />
              <Skeleton
                className={`skeleton-shimmer size-8 animate-none rounded-full bg-transparent ${delay}`}
              />
              <Skeleton
                className={`skeleton-shimmer size-8 animate-none rounded-full bg-transparent ${delay}`}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
