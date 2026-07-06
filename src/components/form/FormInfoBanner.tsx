import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type FormInfoBannerProps = {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function FormInfoBanner({
  icon: Icon,
  children,
  className,
}: FormInfoBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2',
        className,
      )}
    >
      <Icon className="size-4 shrink-0 text-(--accent-deep)" aria-hidden />
      <p className="text-[0.78rem] leading-snug text-(--accent-deep)">
        {children}
      </p>
    </div>
  );
}
