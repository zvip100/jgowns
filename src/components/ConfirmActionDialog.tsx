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
import type { ServerActionErrorResult } from '@/lib/types';

type ConfirmActionDialogState = {
  error: string | null;
  isPending: boolean;
};

type ConfirmActionDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  successMessage?: string;
  onConfirm: () => Promise<ServerActionErrorResult>;
  renderTrigger: (state: ConfirmActionDialogState) => ReactNode;
};

export default function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  pendingLabel = 'Working...',
  confirmVariant = 'default',
  successMessage,
  onConfirm,
  renderTrigger,
}: ConfirmActionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (isPending) return;
    if (open) setError(null);
    setIsOpen(open);
  };

  const handleConfirm = async () => {
    setError(null);
    setIsPending(true);

    try {
      const result = await onConfirm();

      if (result?.error) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
      if (successMessage) toast.success(successMessage);
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
