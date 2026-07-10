import type { ListingWithSizes } from '@/lib/types';

const labelClass =
  'text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--muted-ink)';

type DashboardStatsProps = {
  listings: ListingWithSizes[];
};

export default function DashboardStats({
  listings,
}: DashboardStatsProps) {
  const activeListings = listings.filter((l) => l.status === 'active');
  const availableGowns = activeListings.flatMap((l) =>
    l.sizes.filter((s) => s.status === 'available'),
  );
  const soldGowns = listings
    .flatMap((l) => l.sizes)
    .filter((s) => s.status === 'sold').length;
  const value = availableGowns.reduce((sum, s) => sum + (s.price ?? 0), 0);

  const tiles = [
    { label: 'Listings', value: listings.length },
    { label: 'Available Gowns', value: availableGowns.length, live: true },
    { label: 'Sold Gowns', value: soldGowns },
    { label: 'Inventory', value: `$${value.toLocaleString()}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="surface-panel hairline rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-1.5">
            <p className={labelClass}>{t.label}</p>
            {t.live && (
              <span className="size-1.5 animate-pulse rounded-full bg-(--accent-deep)" />
            )}
          </div>
          <p className="mt-2 font-display text-2xl font-medium text-(--ink) sm:text-3xl">
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}
