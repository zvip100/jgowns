import Link from 'next/link';

import type { LucideIcon } from 'lucide-react';

type NoticePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
};

export default function NoticePanel({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
}: NoticePanelProps) {
  return (
    <div className='mx-auto mt-16 max-w-md text-center sm:mt-24'>
      <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
        <Icon className='mx-auto mb-4 size-12 text-[#8a7462]' />
        <h2 className='text-[1.6rem] text-[#2f241b]'>{title}</h2>
        <p className='mt-2 text-sm text-[#7d6652]'>{description}</p>
        <Link
          href={href}
          className='mt-6 inline-flex w-full items-center justify-center rounded-full border border-[#b58d5f]/70 gold-gradient py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
        >
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}
