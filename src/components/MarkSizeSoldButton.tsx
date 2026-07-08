'use client';

import { CheckCircle2 } from 'lucide-react';

import DashboardActionConfirmButton from '@/components/DashboardActionConfirmButton';
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
    <DashboardActionConfirmButton
      title={`Mark size ${size} as sold?`}
      description="This will mark only this size as sold. The listing will stay active if other sizes are still available."
      confirmLabel="Mark Sold"
      pendingLabel="Marking sold..."
      ariaLabel={`Mark size ${size} as sold`}
      icon={CheckCircle2}
      triggerClassName="inline-flex items-center text-(--accent-deep)/70 transition hover:text-(--accent-deep) disabled:opacity-50"
      triggerStyle="inline-icon"
      onConfirm={() => markSizeSold(listingId, sizeId)}
    />
  );
}
