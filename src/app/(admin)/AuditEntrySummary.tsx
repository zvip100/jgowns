import { AuditActionPill } from "./AuditActionPill";
import { AuditActorGlyph } from "./AuditActorGlyph";

import type { ReactNode } from "react";
import type { AdminAuditLogEntry } from "@/lib/admin/types";

type AuditEntrySummaryProps = {
  entry: Pick<AdminAuditLogEntry, "actor_role" | "action">;
  children?: ReactNode;
};

/** An activity feed row's body: the actor glyph beside the action pill and its details. */
export function AuditEntrySummary({ entry, children }: AuditEntrySummaryProps) {
  return (
    <div className="flex min-w-0 gap-2">
      <AuditActorGlyph role={entry.actor_role} className="mt-0.5" />
      <div className="min-w-0">
        <AuditActionPill action={entry.action} />
        {children}
      </div>
    </div>
  );
}
