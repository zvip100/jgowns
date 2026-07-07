'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { markListingSold } from '@/lib/actions/listings';
import type { Listing } from '@/lib/types';

export default function MarkSoldButton({
  id,
  status,
}: {
  id: string;
  status: Listing['status'];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === 'sold') return null;

  const onClick = () => {
    setError(null);

    start(async () => {
      const result = await markListingSold(id);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label="Mark as sold"
      title={error ?? 'Mark as sold'}
      className="text-(--accent-deep) hover:bg-(--accent-deep)/10 hover:text-(--accent-deep)"
    >
      {pending ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <CheckCircle2 data-icon="inline-start" />
      )}
      <span className="hidden sm:inline">Mark Sold</span>
    </Button>
  );
}
