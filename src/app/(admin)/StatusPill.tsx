import { PILL_BASE_CLASS, PILL_TONE_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { ADMIN_STATUS_LABELS, ADMIN_STATUS_TONES } from "./admin-status";

import type { AdminListingStatus } from "@/lib/admin/types";

type StatusPillProps = {
  status: AdminListingStatus;
  className?: string;
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        PILL_BASE_CLASS,
        PILL_TONE_CLASS[ADMIN_STATUS_TONES[status]],
        className,
      )}
    >
      {ADMIN_STATUS_LABELS[status]}
    </span>
  );
}
