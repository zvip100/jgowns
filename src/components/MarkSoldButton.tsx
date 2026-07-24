'use client';

import { CheckCircle2 } from 'lucide-react';

import ConfirmActionButton from '@/components/ConfirmActionButton';
import { markListingSold } from '@/lib/actions/listings';

import type { Listing } from '@/lib/types';

type MarkSoldButtonProps = {
  id: string;
  status: Listing['status'];
  hasMultipleSizes: boolean;
};

export default function MarkSoldButton({
  id,
  status,
  hasMultipleSizes,
}: MarkSoldButtonProps) {
  if (status !== 'active') return null;

  return (
    <ConfirmActionButton
      title="Mark listing as sold?"
      description={
        hasMultipleSizes
          ? 'This will mark the listing and all sizes as sold.'
          : 'This will mark the listing as sold.'
      }
      confirmLabel="Mark Sold"
      pendingLabel="Marking sold..."
      ariaLabel="Mark as sold"
      buttonLabel="Mark Sold"
      icon={CheckCircle2}
      successMessage="Marked as sold"
      triggerClassName="text-(--accent-deep) hover:bg-(--accent-deep)/10 hover:text-(--accent-deep)"
      onConfirm={() => markListingSold(id)}
    />
  );
}
