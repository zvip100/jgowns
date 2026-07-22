import { TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type WishlistWriteErrorToastProps = {
  message: string | null;
};

/** Brief, non-blocking notice when a signed-in background write fails. Never
 * blocks the UI; the local change stands regardless. */
export function WishlistWriteErrorToast({ message }: WishlistWriteErrorToastProps) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <Alert className="pointer-events-auto w-auto max-w-sm border-[#e6c6a6] bg-[#fff4e8] text-[#7b3e14] shadow-[0_16px_40px_rgba(74,52,30,0.22)]">
        <TriangleAlert />
        <AlertTitle>Not synced</AlertTitle>
        <AlertDescription className="text-[#8a6232]">{message}</AlertDescription>
      </Alert>
    </div>
  );
}
