import Link from 'next/link';

import { GOWN_CATEGORIES } from '@/lib/types';

const MARQUEE_ITEMS = [
  ...GOWN_CATEGORIES.map((category) => ({
    href: `/browse?category=${category.id}`,
    label: category.label,
  })),
  { href: '/browse', label: 'Browse All' },
];

function MarqueeRow({ isHidden }: { isHidden: boolean }) {
  return (
    <ul className='flex shrink-0 items-center gap-10 pr-10'>
      {MARQUEE_ITEMS.map((item) => (
        <li key={item.label} className='flex items-center gap-3 whitespace-nowrap'>
          <Link
            href={item.href}
            aria-hidden={isHidden ? true : undefined}
            tabIndex={isHidden ? -1 : undefined}
            className='font-display text-xl text-(--muted-ink) transition-colors hover:text-(--accent-deep) sm:text-2xl'
          >
            {item.label}
          </Link>
          <span aria-hidden className='text-accent opacity-70'>
            &#10022;
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CategoryMarquee() {
  return (
    <div className='marquee-shell relative overflow-hidden border-y border-(--line) py-5'>
      <div className='pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-(--bg-cream) to-transparent sm:w-28' />
      <div className='pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-(--bg-cream) to-transparent sm:w-28' />

      {/* Track holds the item list four times so each half (two rows, ~2260px)
          is wider than the layout's max-w-375 container and translateX(-50%)
          loops seamlessly with no empty rail. Duplicate copies are hidden from
          assistive tech. */}
      <div className='marquee-track flex w-max'>
        <MarqueeRow isHidden={false} />
        <MarqueeRow isHidden={true} />
        <MarqueeRow isHidden={true} />
        <MarqueeRow isHidden={true} />
      </div>
    </div>
  );
}
