import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type AdminFactProps = {
  label: string;
  children: ReactNode;
  /** Value spacing. Detail pages sit tighter than the metrics health list. */
  valueClassName?: string;
};

/** One label/value pair in an admin detail `<dl>`. */
export function AdminFact({ label, children, valueClassName }: AdminFactProps) {
  return (
    <div>
      <dt className="text-[0.62rem] font-semibold tracking-[0.16em] text-(--muted-ink) uppercase">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-(--ink)", valueClassName)}>{children}</dd>
    </div>
  );
}
