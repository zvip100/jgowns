'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { markSizeSold } from '@/lib/actions/listings';

export default function MarkSizeSoldButton({
  listingId,
  sizeId,
  size,
}: {
  listingId: string;
  sizeId: string;
  size: string;
}) {
  return (
    <ConfirmActionDialog
      title={`Mark size ${size} as sold?`}
      description="This will mark only this size as sold. The listing will stay active if other sizes are still available."
      confirmLabel="Mark Sold"
      pendingLabel="Marking sold..."
      onConfirm={() => markSizeSold(listingId, sizeId)}
      renderTrigger={({ error, isPending }) => (
        <button
          type="button"
          disabled={isPending}
          aria-label={`Mark size ${size} as sold`}
          title={error ?? `Mark size ${size} as sold`}
          className="inline-flex items-center text-(--accent-deep)/70 transition hover:text-(--accent-deep) disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
        </button>
      )}
    />
  );
}
