'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

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
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);

    start(async () => {
      const result = await markSizeSold(listingId, sizeId);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Mark size ${size} as sold`}
      title={error ?? `Mark size ${size} as sold`}
      className="inline-flex items-center text-(--accent-deep)/70 transition hover:text-(--accent-deep) disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="size-3.5" />
      )}
    </button>
  );
}
