/** Shared gold-gradient primary call-to-action button styling */
export const PRIMARY_CTA_CLASS =
  "w-full rounded-full border border-[#b58d5f]/70 gold-gradient text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105";

/**
 * Overrides the shadcn Checkbox checked fill (default --primary, a dark brown)
 * with the brand gold gradient. Applied per-instance because the primitive in
 * src/components/ui must not be edited.
 */
export const CHECKBOX_GOLD_CLASS =
  "data-[state=checked]:gold-gradient data-[state=checked]:border-[#a67841]!";

/** Inline underlined gold text link (legal documents + the contact intro). */
export const LEGAL_LINK_CLASS =
  "text-(--accent-deep) underline underline-offset-2 transition-colors hover:text-[#a0733f]";

/** Circular heart-icon button shared by the wishlist heart toggle and navbar trigger. */
export const WISHLIST_HEART_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors";
export const WISHLIST_HEART_UNSAVED_CLASS =
  "border-[#decdb8] bg-[#fff9f0] text-[#a08a72] hover:text-[#8a6232]";
export const WISHLIST_HEART_SAVED_CLASS =
  "border-[#b58d5f]/70 bg-[#b3854c]/12 text-[#8a6232]";
