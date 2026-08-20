import type { AdminActorRole } from "@/lib/admin/types";

/** Shared gold-gradient primary call-to-action button styling */
export const PRIMARY_CTA_CLASS =
  "w-full rounded-full border border-[#b58d5f]/70 gold-gradient text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105";

/** NoticePanel's two action slots, shared so an external action matches the panel's own. */
export const NOTICE_PANEL_PRIMARY_ACTION_CLASS =
  "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b58d5f]/70 gold-gradient py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105";
export const NOTICE_PANEL_SECONDARY_ACTION_CLASS =
  "mt-4 inline-flex w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] text-(--accent-deep) transition hover:text-[#2f241b]";

/**
 * Overrides the shadcn Checkbox checked fill (default --primary, a dark brown)
 * with the brand gold gradient. Applied per-instance because the primitive in
 * src/components/ui must not be edited.
 */
export const CHECKBOX_GOLD_CLASS =
  "data-[state=checked]:gold-gradient data-[state=checked]:border-[#a67841]!";

/**
 * Ring treatment shared by the two browse filter count badges: the per-section
 * count in the rail and the total on the filter trigger. Each call site adds
 * its own sizing.
 */
export const FILTER_COUNT_BADGE_CLASS =
  "rounded-full border-transparent bg-[#fffdfa] font-semibold text-[#8e6330] shadow-[inset_0_0_0_1.5px_#b3854c]";

/**
 * Hides the scrollbar on a horizontal scroller that already reads as scrollable
 * (browse category rail). Cross-engine: Firefox, legacy Edge, WebKit/Blink.
 */
export const HIDDEN_SCROLLBAR_CLASS =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Inline underlined gold text link (legal documents + the contact intro). */
export const LEGAL_LINK_CLASS =
  "text-(--accent-deep) underline underline-offset-2 transition-colors hover:text-[#a0733f]";

/* Selectable filter pill, shared by the browse filters and the admin segment
   row. A pill must never change width when toggled, or a wrapped row reflows.
   Two reservations keep it fixed: idle padding holds the check's footprint
   (0.78em icon + 0.34em gap) symmetrically and trades it back when the check
   appears, and the label stacks an invisible semibold twin so the box always
   measures its bold width. Both transitions share duration-200 so the width
   also holds steady mid-animation; font-weight is left untransitioned on
   purpose so it snaps instead of drifting the metrics. */
export const FILTER_PILL_CLASS =
  "group inline-flex min-w-[2.4rem] items-center justify-center rounded-full border border-[#e0cfb6] bg-white/45 px-[calc(0.75rem+0.56em)] py-1.5 text-[0.72rem] font-medium text-[#6a5544] outline-none transition-[background-color,border-color,color,padding] duration-200 hover:bg-white/80 hover:text-[#3f3023] focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[active=true]:border-[#cbab84] data-[active=true]:bg-[rgba(179,133,76,0.14)] data-[active=true]:px-3 data-[active=true]:font-semibold data-[active=true]:text-[#875f2f]";

export const FILTER_PILL_CHECK_CLASS =
  "h-[0.78em] w-0 shrink-0 overflow-hidden opacity-0 transition-[width,opacity,margin] duration-200 group-data-[active=true]:mr-[0.34em] group-data-[active=true]:w-[0.78em] group-data-[active=true]:opacity-100";

/**
 * Admin pill vocabulary, shared by the listing StatusPill and the audit-log
 * action pill so the two surfaces can never drift to different reds or greens.
 * Each consumer maps its own domain values onto a tone.
 */
export const PILL_BASE_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold tracking-wide";

export type PillTone =
  | "positive"
  | "critical"
  | "warning"
  | "gold"
  | "sold"
  | "neutral";

export const PILL_TONE_CLASS: Record<PillTone, string> = {
  positive: "bg-[#e8f4ec] text-[#2d7a4f]",
  critical: "bg-[#f3e8e8] text-[#8a3a3a]",
  warning: "bg-[#fef4e0] text-[#8a6a30]",
  gold: "bg-(--accent)/15 text-(--accent-deep)",
  sold: "bg-(--sold) text-white",
  neutral: "bg-[#f5efe4] text-[#6a5544]",
};

/**
 * Tinted disc behind the actor glyph on every activity surface. Naming the
 * actor beats implying it through a row tint or rail: it survives a greyscale
 * or colour-blind read on its own, for a fixed 1.4rem column.
 */
export const AUDIT_ROLE_GLYPH_CLASS: Record<AdminActorRole, string> = {
  admin: "bg-(--accent)/20 text-(--accent-deep)",
  seller: "bg-[#f5efe4] text-[#6a5544]",
  system: "bg-(--muted-ink)/12 text-(--muted-ink)",
};

/**
 * Marketplace nav link, one per breakpoint. Shared by the Navbar's own links,
 * the auth links, and the admin link so the three can never drift apart. Both
 * are flex containers so a link carrying a trailing icon needs only a gap.
 */
export const NAV_LINK_CLASS =
  "inline-flex items-center text-[0.9rem] font-semibold tracking-[0.06em] uppercase text-[#6d5a49] hover:text-[#a0733f]";
export const NAV_LINK_MOBILE_CLASS =
  "flex min-h-11 items-center text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-[#6d5a49]";

/**
 * Admin badge in the navbar's account cluster. A chip rather than a nav link:
 * it leaves the storefront for a different app, so it should not read as a peer
 * of Browse. The tint is capped at 8% by MEASUREMENT, not taste — --accent-deep
 * on an 8% --accent wash over the header cream is 4.55:1, and the 12% wash it
 * wants to be drops to 4.47:1, under AA for text this size.
 */
export const NAV_ADMIN_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-(--accent)/8 px-2.5 py-1 text-[0.72rem] font-semibold tracking-[0.11em] uppercase text-(--accent-deep) transition-colors hover:bg-(--accent)/16 hover:text-(--ink)";

/** Circular heart-icon button shared by the wishlist heart toggle and navbar trigger. */
export const WISHLIST_HEART_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors";
export const WISHLIST_HEART_UNSAVED_CLASS =
  "border-[#decdb8] bg-[#fff9f0] text-[#a08a72] hover:text-[#8a6232]";
export const WISHLIST_HEART_SAVED_CLASS =
  "border-[#b58d5f]/70 bg-[#b3854c]/12 text-[#8a6232]";
