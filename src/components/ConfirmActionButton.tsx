'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConfirmActionBodyState } from '@/components/ConfirmActionDialog';
import type { ServerActionResult } from '@/lib/types';

type ConfirmActionButtonProps<TValue> = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  ariaLabel: string;
  buttonLabel?: string;
  /**
   * Keeps `buttonLabel` visible below `sm`, where it is otherwise hidden so a
   * packed row of admin actions can fit. A control that stands alone in its own
   * row has no such constraint, and an unlabelled icon there reads as a stray
   * glyph rather than an action.
   */
  isLabelAlwaysShown?: boolean;
  icon: LucideIcon;
  confirmVariant?: 'default' | 'destructive';
  successMessage?: string;
  triggerClassName: string;
  triggerStyle?: 'button' | 'inline-icon';
  /** Renders the trigger inert. */
  disabled?: boolean;
  /** Passed straight through; see ConfirmActionDialog for the contract. */
  initialValue?: TValue;
  renderBody?: (state: ConfirmActionBodyState<TValue>) => ReactNode;
  validate?: (value: TValue) => boolean;
  onOpen?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: (value: TValue) => Promise<ServerActionResult>;
};

export default function ConfirmActionButton<TValue = void>({
  title,
  description,
  confirmLabel,
  pendingLabel,
  ariaLabel,
  buttonLabel,
  isLabelAlwaysShown = false,
  icon: Icon,
  confirmVariant = 'default',
  successMessage,
  triggerClassName,
  triggerStyle = 'button',
  disabled = false,
  initialValue,
  renderBody,
  validate,
  onOpen,
  open,
  onOpenChange,
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
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      renderTrigger={({ error, isPending }) =>
        triggerStyle === 'inline-icon' ? (
          <button
            type="button"
            disabled={disabled || isPending}
            aria-label={ariaLabel}
            title={error ?? ariaLabel}
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
            title={error ?? ariaLabel}
            className={triggerClassName}
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Icon data-icon="inline-start" />
            )}
            {buttonLabel && (
              <span className={isLabelAlwaysShown ? undefined : "hidden sm:inline"}>
                {buttonLabel}
              </span>
            )}
          </Button>
        )
      }
    />
  );
}
