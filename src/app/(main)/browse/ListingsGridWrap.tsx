import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type ListingsGridWrapProps = {
  children: ReactNode;
  className?: string;
};

/**
 * `minmax(15rem, 1fr)` packs as many columns as fit at 15rem, then stretches
 * them to fill the row. `auto-fill` (unlike `auto-fit`) keeps empty tracks
 * alive, so sparse rows stay left-aligned instead of re-centering as a clump.
 */
export default function ListingsGridWrap({
  children,
  className,
}: ListingsGridWrapProps) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full min-w-0 max-w-6xl grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 sm:gap-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
