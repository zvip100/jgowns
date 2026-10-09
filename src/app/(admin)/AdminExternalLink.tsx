import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AdminExternalLinkProps = {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
};

/** A small gold text link that opens in a new tab. */
export function AdminExternalLink({
  href,
  children,
  icon: Icon,
}: AdminExternalLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit shrink-0 items-center gap-1.5 text-xs font-semibold text-(--accent-deep) transition hover:text-(--ink)"
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
      <ExternalLink className="size-3.5" aria-hidden />
    </Link>
  );
}
