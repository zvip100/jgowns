import { Server, ShieldCheck, User } from "lucide-react";

import { AUDIT_ROLE_GLYPH_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

import type { AdminActorRole } from "@/lib/admin/types";
import type { LucideIcon } from "lucide-react";

const ROLE_ICONS: Record<AdminActorRole, LucideIcon> = {
  admin: ShieldCheck,
  seller: User,
  system: Server,
};

type AuditActorGlyphProps = {
  role: AdminActorRole;
  className?: string;
};

/**
 * Names who acted on every activity row. Decorative on its own: the accessible
 * name comes from the adjacent actor text, which is the email or "System".
 */
export function AuditActorGlyph({ role, className }: AuditActorGlyphProps) {
  const Icon = ROLE_ICONS[role];

  return (
    <span
      className={cn(
        "inline-flex size-[1.4rem] shrink-0 items-center justify-center rounded-full",
        AUDIT_ROLE_GLYPH_CLASS[role],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}
