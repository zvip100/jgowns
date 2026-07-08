'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import { markListingSold } from '@/lib/actions/listings';

import type { Listing } from '@/lib/types';

export default function MarkSoldButton({
  id,
  status,
}: {
  id: string;
  status: Listing['status'];
}) {
  if (status !== 'active') return null;

  return (
    <ConfirmActionDialog
      title="Mark listing as sold?"
      description="This will mark the full listing and every size in it as sold."
      confirmLabel="Mark Sold"
      pendingLabel="Marking sold..."
      onConfirm={() => markListingSold(id)}
      renderTrigger={({ error, isPending }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label="Mark as sold"
          title={error ?? 'Mark as sold'}
          className="text-(--accent-deep) hover:bg-(--accent-deep)/10 hover:text-(--accent-deep)"
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <CheckCircle2 data-icon="inline-start" />
          )}
          <span className="hidden sm:inline">Mark Sold</span>
        </Button>
      )}
    />
  );
}
