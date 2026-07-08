'use client';

import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { removeListing } from '@/lib/actions/listings';

type RemoveListingButtonProps = {
  id: string;
};

export default function RemoveListingButton({ id }: RemoveListingButtonProps) {
  return (
    <ConfirmActionDialog
      title="Remove listing?"
      description="This will remove the listing from browse and your dashboard. It will not permanently delete the database record."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      confirmVariant="destructive"
      onConfirm={() => removeListing(id)}
      renderTrigger={({ error, isPending }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label="Remove listing"
          title={error ?? 'Remove listing'}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Trash2 data-icon="inline-start" />
          )}
          <span className="hidden sm:inline">Remove</span>
        </Button>
      )}
    />
  );
}
