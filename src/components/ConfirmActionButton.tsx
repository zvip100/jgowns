'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';

import type { LucideIcon } from 'lucide-react';
import type { ServerActionErrorResult } from '@/lib/types';

type ConfirmActionButtonProps = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  ariaLabel: string;
  buttonLabel?: string;
  icon: LucideIcon;
  confirmVariant?: 'default' | 'destructive';
  successMessage?: string;
  triggerClassName: string;
  triggerStyle?: 'button' | 'inline-icon';
  onConfirm: () => Promise<ServerActionErrorResult>;
};

export default function ConfirmActionButton({
  title,
  description,
  confirmLabel,
  pendingLabel,
  ariaLabel,
  buttonLabel,
  icon: Icon,
  confirmVariant = 'default',
  successMessage,
  triggerClassName,
  triggerStyle = 'button',
  onConfirm,
}: ConfirmActionButtonProps) {
  return (
    <ConfirmActionDialog
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pendingLabel={pendingLabel}
      confirmVariant={confirmVariant}
      successMessage={successMessage}
      onConfirm={onConfirm}
      renderTrigger={({ error, isPending }) =>
        triggerStyle === 'inline-icon' ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={ariaLabel}
            title={error ?? ariaLabel}
            className={triggerClassName}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Icon className="size-3.5" />
            )}
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={ariaLabel}
            title={error ?? ariaLabel}
            className={triggerClassName}
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Icon data-icon="inline-start" />
            )}
            {buttonLabel && (
              <span className="hidden sm:inline">{buttonLabel}</span>
            )}
          </Button>
        )
      }
    />
  );
}
