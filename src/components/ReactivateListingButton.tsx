'use client';

import { RotateCcw } from 'lucide-react';

import ConfirmActionButton from '@/components/ConfirmActionButton';
import { reactivateListing } from '@/lib/actions/listings';
import { ROW_ACCENT_ACTION_CLASS } from '@/lib/styles';

import type { Listing } from '@/lib/types';

type ReactivateListingButtonProps = {
  id: string;
  status: Listing['status'];
  hasMultipleSizes: boolean;
};

export default function ReactivateListingButton({
  id,
  status,
  hasMultipleSizes,
}: ReactivateListingButtonProps) {
  if (status !== 'sold') return null;

  return (
    <ConfirmActionButton
      title="Reactivate listing?"
      description={
        hasMultipleSizes
          ? 'This will make the listing active again and mark all sizes available.'
          : 'This will make the listing active again.'
      }
      confirmLabel="Reactivate"
      pendingLabel="Reactivating..."
      ariaLabel="Reactivate listing"
      buttonLabel="Reactivate"
      icon={RotateCcw}
      successMessage="Listing reactivated"
      triggerClassName={ROW_ACCENT_ACTION_CLASS}
      onConfirm={() => reactivateListing(id)}
    />
  );
}
