'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConfirmActionBodyState } from '@/components/ConfirmActionDialog';
import type { ServerActionErrorResult } from '@/lib/types';

type ConfirmActionButtonProps<TValue> = {
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
  /** Renders the trigger inert. `disabledTitle` says why on hover. */
  disabled?: boolean;
  disabledTitle?: string;
  /** Passed straight through; see ConfirmActionDialog for the contract. */
  initialValue?: TValue;
  renderBody?: (state: ConfirmActionBodyState<TValue>) => ReactNode;
  validate?: (value: TValue) => boolean;
  onOpen?: () => void;
  onConfirm: (value: TValue) => Promise<ServerActionErrorResult>;
};

/** An inert trigger explains itself; a live one keeps the last action error. */
function triggerTitle(
  disabled: boolean,
  disabledTitle: string | undefined,
  error: string | null,
  ariaLabel: string,
): string {
  if (disabled && disabledTitle) return disabledTitle;
  return error ?? ariaLabel;
}

export default function ConfirmActionButton<TValue = void>({
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
  disabled = false,
  disabledTitle,
  initialValue,
  renderBody,
  validate,
  onOpen,
  onConfirm,
}: ConfirmActionButtonProps<TValue>) {
  return (
    <ConfirmActionDialog<TValue>
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pendingLabel={pendingLabel}
      confirmVariant={confirmVariant}
      successMessage={successMessage}
      initialValue={initialValue}
      renderBody={renderBody}
      validate={validate}
      onOpen={onOpen}
      onConfirm={onConfirm}
      renderTrigger={({ error, isPending }) =>
        triggerStyle === 'inline-icon' ? (
          <button
            type="button"
            disabled={disabled || isPending}
            aria-label={ariaLabel}
            title={triggerTitle(disabled, disabledTitle, error, ariaLabel)}
            // shadcn's Button dims itself when disabled; this raw trigger has
            // to, or an inert control looks live. Only for `disabled`, so the
            // pending spinner keeps reading as work in progress.
            className={cn(triggerClassName, disabled && 'opacity-50')}
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
            disabled={disabled || isPending}
            aria-label={ariaLabel}
            title={triggerTitle(disabled, disabledTitle, error, ariaLabel)}
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
