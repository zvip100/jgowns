'use client';

import { Trash2 } from 'lucide-react';

import DashboardActionConfirmButton from '@/components/DashboardActionConfirmButton';
import { removeListing } from '@/lib/actions/listings';

type RemoveListingButtonProps = {
  id: string;
};

export default function RemoveListingButton({ id }: RemoveListingButtonProps) {
  return (
    <DashboardActionConfirmButton
      title="Remove listing?"
      description="This will remove the listing from browse and your dashboard. It will not permanently delete the database record."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      ariaLabel="Remove listing"
      buttonLabel="Remove"
      icon={Trash2}
      confirmVariant="destructive"
      triggerClassName="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onConfirm={() => removeListing(id)}
    />
  );
}
