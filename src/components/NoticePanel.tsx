import Link from 'next/link';

import {
  NOTICE_PANEL_PRIMARY_ACTION_CLASS,
  NOTICE_PANEL_SECONDARY_ACTION_CLASS,
} from '@/lib/styles';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Give the primary slot either `href` + `linkLabel`, or a `primaryAction` node. */
type NoticePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  primaryAction?: ReactNode;
  secondaryHref?: string;
  secondaryLinkLabel?: string;
  children?: ReactNode;
  footnote?: string;
  className?: string;
};

export default function NoticePanel({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
  primaryAction,
  secondaryHref,
  secondaryLinkLabel,
  children,
  footnote,
  className,
}: NoticePanelProps) {
  return (
    <div className={cn('mx-auto mt-16 max-w-md text-center sm:mt-24', className)}>
      <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
        <Icon className='mx-auto mb-4 size-12 text-[#8a7462]' aria-hidden />
        <h2 className='text-[1.6rem] text-[#2f241b]'>{title}</h2>
        <p className='mt-2 text-sm text-[#7d6652]'>{description}</p>
        {children}
        {primaryAction}
        {href && linkLabel && (
          <Link href={href} className={NOTICE_PANEL_PRIMARY_ACTION_CLASS}>
            {linkLabel}
          </Link>
        )}
        {secondaryHref && secondaryLinkLabel && (
          <Link
            href={secondaryHref}
            className={NOTICE_PANEL_SECONDARY_ACTION_CLASS}
          >
            {secondaryLinkLabel}
          </Link>
        )}
        {footnote && (
          <p className='mt-5 border-t border-(--line) pt-4 text-xs text-[#7d6652]'>
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
