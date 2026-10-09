import Link from "next/link";

import { auditActorName } from "../../admin-audit-labels";
import { AuditActorGlyph } from "../../AuditActorGlyph";

import type { AdminAuditLogEntry } from "@/lib/admin/types";

type LogActorProps = {
  entry: Pick<AdminAuditLogEntry, "actor_id" | "actor_email" | "actor_role">;
};

/** Links the actor to their user page; System and deleted accounts have no id. */
export function LogActor({ entry }: LogActorProps) {
  const name = auditActorName(entry.actor_email, entry.actor_role);

  return (
    <span className="flex items-center gap-2">
      <AuditActorGlyph role={entry.actor_role} />
      {entry.actor_id ? (
        <Link
          href={`/admin/users/${entry.actor_id}`}
          className="font-medium text-(--ink) hover:text-(--accent-deep)"
        >
          {name}
        </Link>
      ) : (
        <span
          className={
            entry.actor_role === "system"
              ? "text-(--muted-ink) italic"
              : undefined
          }
        >
          {name}
        </span>
      )}
    </span>
  );
}
