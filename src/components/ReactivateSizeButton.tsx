'use client';

import { RotateCcw } from 'lucide-react';

import ConfirmActionButton from '@/components/ConfirmActionButton';
import { reactivateSize } from '@/lib/actions/listings';

type ReactivateSizeButtonProps = {
  listingId: string;
  sizeId: string;
  size: string;
};

export default function ReactivateSizeButton({
  listingId,
  sizeId,
  size,
}: ReactivateSizeButtonProps) {
  return (
    <ConfirmActionButton
      title={`Reactivate size ${size}?`}
      description="This will mark this size as available again."
      confirmLabel="Reactivate"
      pendingLabel="Reactivating..."
      ariaLabel={`Reactivate size ${size}`}
      icon={RotateCcw}
      triggerClassName="inline-flex items-center text-(--accent-deep)/70 transition hover:text-(--accent-deep) disabled:opacity-50"
      triggerStyle="inline-icon"
      onConfirm={() => reactivateSize(listingId, sizeId)}
    />
  );
}
