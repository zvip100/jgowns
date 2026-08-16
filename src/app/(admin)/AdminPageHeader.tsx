import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Trailing control, right-aligned from sm up (Edit listing, Open PostHog). */
  action?: ReactNode;
  /** Meta row under the title: status pills, provider and role badges. */
  children?: ReactNode;
  variant?: "page" | "detail";
};

/**
 * The one admin page header. `page` titles a section (Overview, Listings) and is
 * static, so it renders while the section's data streams in behind it; `detail`
 * titles a single record and runs a size down, since that title is data.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  children,
  variant = "page",
}: AdminPageHeaderProps) {
  const isDetail = variant === "detail";

  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:justify-between",
        isDetail ? "sm:items-start" : "sm:items-end",
      )}
    >
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
          {eyebrow}
        </p>
        <h1
          className={cn(
            "mt-2 font-display leading-tight text-(--ink)",
            isDetail
              ? "text-[1.75rem] sm:text-[2.1rem]"
              : "text-[2rem] sm:text-[2.4rem]",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-(--muted-ink)">{description}</p>
        )}
        {children}
      </div>
      {action}
    </header>
  );
}
