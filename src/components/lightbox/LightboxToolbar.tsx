'use client';

import type { ReactNode } from 'react';

type LightboxToolbarProps = {
  left: ReactNode;
  right: ReactNode;
};

/**
 * The inspector frame's footer: navigation on the left, view controls on the
 * right. A separate leaf because the row is laid out to take photo actions
 * later without a re-layout, and because the frame's own file is already the
 * viewer's whole interaction surface.
 *
 * `left` may be null at one photo, and the row still holds its height so the
 * frame does not resize between a one-photo and a three-photo listing.
 */
export function LightboxToolbar({ left, right }: LightboxToolbarProps) {
  return (
    <footer className="flex min-h-13 items-center justify-between gap-3 border-t border-(--line) px-4 py-2.5">
      <div className="flex items-center gap-1.5">{left}</div>
      {right}
    </footer>
  );
}
