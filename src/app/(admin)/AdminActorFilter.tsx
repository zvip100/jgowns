import { ADMIN_ACTOR_ROLES } from "@/lib/admin/types";

import { AdminFilterPill } from "./AdminFilterPill";
import { AuditActorGlyph } from "./AuditActorGlyph";
import { ADMIN_ACTOR_PARAM } from "./admin-url";

import type { AdminActorRole } from "@/lib/admin/types";

const ACTOR_LABELS: Record<AdminActorRole, string> = {
  admin: "Admin",
  seller: "Seller",
  system: "System",
};

/** The table renders the disc at 1.4rem, which swamps a 0.72rem pill. */
const PILL_GLYPH_CLASS = "mr-[0.4em] size-[1.05rem] [&>svg]:size-[0.68rem]";

type AdminActorFilterProps = {
  active: string;
  buildHref: (overrides: Record<string, string | undefined>) => string;
};

/**
 * Who acted: a second axis beside the entity segments, sharing their pill
 * vocabulary. A control with its own shape was what pushed the refine row past
 * its own minimum width; separation now comes from the wider gap between the
 * two groups plus the role glyph, which is the glyph the Actor column renders.
 * No "All" pill, because the segments already own one on the same line, so an
 * active pill links back to the unfiltered view instead.
 */
export function AdminActorFilter({ active, buildHref }: AdminActorFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ADMIN_ACTOR_ROLES.map((role) => {
        const isActive = active === role;
        return (
          <AdminFilterPill
            key={role}
            href={buildHref({
              [ADMIN_ACTOR_PARAM]: isActive ? undefined : role,
              page: undefined,
            })}
            isActive={isActive}
            label={ACTOR_LABELS[role]}
            icon={<AuditActorGlyph role={role} className={PILL_GLYPH_CLASS} />}
          />
        );
      })}
    </div>
  );
}
