import { ADMIN_CHART_PANEL_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { AdminSectionHeading } from "./AdminSectionHeading";

import type { ReactNode } from "react";

type AdminChartPanelProps = {
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
};

/** The titled card every admin chart sits in (Metrics, Traffic). */
export function AdminChartPanel({
  title,
  subtitle,
  className,
  children,
}: AdminChartPanelProps) {
  return (
    <div className={cn(ADMIN_CHART_PANEL_CLASS, className)}>
      <AdminSectionHeading>{title}</AdminSectionHeading>
      <p className="mt-1 text-xs text-(--muted-ink)">{subtitle}</p>
      {children}
    </div>
  );
}
