'use client';

import { CreditCard, Gift, Loader2 } from 'lucide-react';
import { useActionState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { createListingCheckout } from '@/lib/actions/payments';
import { PRIMARY_CTA_CLASS, ROW_ACCENT_ACTION_CLASS } from '@/lib/styles';
import { toast } from '@/lib/toast';

import type { ServerActionErrorResult } from '@/lib/types';

type PublishListingButtonProps = {
  listingId: string;
  label: string;
  variant?: 'row' | 'cta';
  /** Admin only: publishes without the fee. The action enforces the role. */
  isFeeWaived?: boolean;
};

const ROW_PAY_CLASS =
  'gold-gradient border border-[#b58d5f]/70 text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:brightness-105';

export default function PublishListingButton({
  listingId,
  label,
  variant = 'row',
  isFeeWaived = false,
}: PublishListingButtonProps) {
  const [state, formAction, isPending] = useActionState<
    ServerActionErrorResult | null,
    FormData
  >(() => createListingCheckout(listingId, isFeeWaived), null);
  const toastedStateRef = useRef<ServerActionErrorResult | null>(null);

  // Activity re-runs this effect when a hidden route shows again, so each
  // result is toasted once rather than on every return to the page.
  useEffect(() => {
    if (!state?.error || toastedStateRef.current === state) return;
    toastedStateRef.current = state;
    toast.error(
      isFeeWaived ? "Couldn't publish listing" : "Couldn't start checkout",
      { description: state.error },
    );
  }, [state, isFeeWaived]);

  const RowIcon = isFeeWaived ? Gift : CreditCard;

  return (
    <form
      action={formAction}
      className={
        variant === 'cta'
          ? 'mt-6 flex flex-col gap-2'
          : 'flex flex-col items-end gap-1'
      }
    >
      {variant === 'cta' ? (
        <button
          type="submit"
          disabled={isPending}
          className={`${PRIMARY_CTA_CLASS} h-12`}
        >
          {label}
        </button>
      ) : (
        <Button
          type="submit"
          size="sm"
          variant={isFeeWaived ? 'ghost' : 'default'}
          disabled={isPending}
          aria-label={label}
          className={isFeeWaived ? ROW_ACCENT_ACTION_CLASS : ROW_PAY_CLASS}
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RowIcon data-icon="inline-start" />
          )}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      )}
    </form>
  );
}
