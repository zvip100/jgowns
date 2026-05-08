import type { Listing } from '@/lib/types';

const labelClass =
  'text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--muted-ink)';

export default function DashboardStats({ listings }: { listings: Listing[] }) {
  const total = listings.length;
  const active = listings.filter((l) => l.status === 'active').length;
  const sold = listings.filter((l) => l.status === 'sold').length;
  const value = listings
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + (l.price ?? 0), 0);

  const tiles = [
    { label: 'Listed', value: total },
    { label: 'Active', value: active, live: true },
    { label: 'Sold', value: sold },
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
