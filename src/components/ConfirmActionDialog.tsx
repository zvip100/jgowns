'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { PRIMARY_CTA_CLASS } from '@/lib/styles';

import type { ReactNode } from 'react';
import type { ServerActionResult } from '@/lib/types';

type ConfirmActionDialogState = {
  error: string | null;
  isPending: boolean;
};

/** What a `renderBody` slot is handed so it can draw and drive its own input. */
export type ConfirmActionBodyState<TValue> = {
  value: TValue;
  setValue: (next: TValue) => void;
  isPending: boolean;
};

type ConfirmActionDialogProps<TValue> = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  successMessage?: string;
  /**
   * Optional input inside the dialog, for an action that needs one (suspend
   * takes a reason). The dialog owns the value so the pending and error
   * handling stays in one place, and hands it to `onConfirm`. An action with no
   * input passes neither prop and keeps its zero-argument call shape.
   */
  initialValue?: TValue;
  renderBody?: (state: ConfirmActionBodyState<TValue>) => ReactNode;
  /**
   * Runs before `onConfirm`. Returning false keeps the dialog open and sets no
   * banner message, because a field-level failure belongs on the field itself
   * (AGENTS §7) and the body is what renders it.
   */
  validate?: (value: TValue) => boolean;
  /**
   * Reopening starts clean. The dialog resets the value and its own banner; a
   * body that keeps field errors outside it clears them here, or a fresh dialog
   * opens still showing the last attempt's message.
   */
  onOpen?: () => void;
  onConfirm: (value: TValue) => Promise<ServerActionResult>;
  renderTrigger: (state: ConfirmActionDialogState) => ReactNode;
};

export default function ConfirmActionDialog<TValue = void>({
  title,
  description,
  confirmLabel,
  pendingLabel = 'Working...',
  confirmVariant = 'default',
  successMessage,
  initialValue,
  renderBody,
  validate,
  onOpen,
  onConfirm,
  renderTrigger,
}: ConfirmActionDialogProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cast because TValue defaults to `void` for the zero-input call sites, where
  // `initialValue` is correctly absent and the value is never read.
  const [value, setValue] = useState<TValue>(initialValue as TValue);

  const handleOpenChange = (open: boolean) => {
    if (isPending) return;
    if (open) {
      setError(null);
      // Reopening starts clean, so a cancelled reason is not silently reused.
      // Same cast, same reason as above.
      setValue(initialValue as TValue);
      onOpen?.();
    }
    setIsOpen(open);
  };

  const handleConfirm = async () => {
    setError(null);
    if (validate && !validate(value)) return;
    setIsPending(true);

    try {
      const result = await onConfirm(value);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
      // An action whose success is not always the same news says so itself.
      const outcome = result?.notice ?? successMessage;
      if (outcome) toast.success(outcome);
    } catch (actionError: unknown) {
      console.error('Confirmed action failed:', actionError);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {renderTrigger({ error, isPending })}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {renderBody?.({ value, setValue, isPending })}
        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant={confirmVariant}
            className={
              confirmVariant === 'default'
                ? `${PRIMARY_CTA_CLASS} w-auto px-4 disabled:translate-y-0`
                : undefined
            }
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            )}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
