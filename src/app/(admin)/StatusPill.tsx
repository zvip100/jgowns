import {
  LISTING_STATUS_TONE,
  PILL_BASE_CLASS,
  PILL_TONE_CLASS,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { ADMIN_STATUS_LABELS } from "./admin-audit-labels";

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
        PILL_TONE_CLASS[LISTING_STATUS_TONE[status]],
        className,
      )}
    >
      {ADMIN_STATUS_LABELS[status]}
    </span>
  );
}
