import Link from "next/link";
import { Check } from "lucide-react";

import { FILTER_PILL_CHECK_CLASS, FILTER_PILL_CLASS } from "@/lib/styles";

import type { ReactNode } from "react";

type AdminFilterPillProps = {
  href: string;
  isActive: boolean;
  label: string;
  /** Sits between the check and the label. The actor axis passes its role glyph. */
  icon?: ReactNode;
};

/**
 * One selectable facet in an admin filter row, in the pill vocabulary the browse
 * filters already use. The label stacks an invisible semibold twin so the pill
 * measures its bold width at rest and never reflows the row when it activates.
 */
export function AdminFilterPill({
  href,
  isActive,
  label,
  icon,
}: AdminFilterPillProps) {
  return (
    <Link
      href={href}
      data-active={isActive}
      aria-current={isActive ? "true" : undefined}
      className={FILTER_PILL_CLASS}
    >
      <Check
        className={FILTER_PILL_CHECK_CLASS}
        strokeWidth={3}
        aria-hidden="true"
      />
      {icon}
      <span className="grid">
        <span className="col-start-1 row-start-1">{label}</span>
        <span
          className="invisible col-start-1 row-start-1 font-semibold"
          aria-hidden
        >
          {label}
        </span>
      </span>
    </Link>
  );
}
