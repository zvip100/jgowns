'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { createListingCheckout } from '@/lib/actions/payments';
import { PRIMARY_CTA_CLASS } from '@/lib/styles';
import { toast } from '@/lib/toast';

import type { ServerActionErrorResult } from '@/lib/types';

type CompletePaymentButtonProps = {
  listingId: string;
  label: string;
  variant?: 'row' | 'cta';
};

export default function CompletePaymentButton({
  listingId,
  label,
  variant = 'row',
}: CompletePaymentButtonProps) {
  const [state, formAction, isPending] = useActionState<
    ServerActionErrorResult | null,
    FormData
  >(() => createListingCheckout(listingId), null);

  useEffect(() => {
    if (state?.error) {
      toast.error("Couldn't start checkout", { description: state.error });
    }
  }, [state]);

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
          disabled={isPending}
          className="gold-gradient border border-[#b58d5f]/70 text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:brightness-105"
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <CreditCard data-icon="inline-start" />
          )}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      )}
    </form>
  );
}
