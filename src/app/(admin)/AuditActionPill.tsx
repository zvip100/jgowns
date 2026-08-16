import { PILL_BASE_CLASS, PILL_TONE_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { AUDIT_ACTION_LABELS, AUDIT_ACTION_TONES } from "./admin-audit-labels";

import type { AdminAuditAction } from "./admin-types";

type AuditActionPillProps = {
  action: AdminAuditAction;
  className?: string;
};

export function AuditActionPill({ action, className }: AuditActionPillProps) {
  return (
    <span
      className={cn(
        PILL_BASE_CLASS,
        PILL_TONE_CLASS[AUDIT_ACTION_TONES[action]],
        className,
      )}
    >
      {AUDIT_ACTION_LABELS[action]}
    </span>
  );
}
