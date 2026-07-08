'use client';

import { CheckCircle2 } from 'lucide-react';

import DashboardActionConfirmButton from '@/components/DashboardActionConfirmButton';
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
    <DashboardActionConfirmButton
      title="Mark listing as sold?"
      description="This will mark the full listing and every size in it as sold."
      confirmLabel="Mark Sold"
      pendingLabel="Marking sold..."
      ariaLabel="Mark as sold"
      buttonLabel="Mark Sold"
      icon={CheckCircle2}
      triggerClassName="text-(--accent-deep) hover:bg-(--accent-deep)/10 hover:text-(--accent-deep)"
      onConfirm={() => markListingSold(id)}
    />
  );
}
