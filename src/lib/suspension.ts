/**
 * Moderation vocabulary, shared by the admin suspend dialog, the admin action's
 * zod schema, and the seller-facing notice.
 */

export const SUSPENSION_SLUGS = [
  "spam",
  "wrong-category",
  "prohibited-item",
  "image-policy",
  "duplicate",
  "other",
] as const;

export type SuspensionSlug = (typeof SUSPENSION_SLUGS)[number];

/** Longest free-text note an operator may attach to a suspension. */
export const MAX_SUSPENSION_NOTE_LENGTH = 500;

/** Operator-facing, for the suspend dialog's picker. */
export const SUSPENSION_SLUG_LABELS: Record<SuspensionSlug, string> = {
  spam: "Spam",
  "wrong-category": "Wrong category",
  "prohibited-item": "Prohibited item",
  "image-policy": "Image policy",
  duplicate: "Duplicate",
  other: "Other",
};

/**
 * Seller-facing. The raw slugs are moderator vocabulary, and the note is
 * optional, so the slug is sometimes all a seller has to go on.
 */
export const SUSPENSION_REASON_SENTENCES: Record<SuspensionSlug, string> = {
  spam: "This listing was flagged as spam.",
  "wrong-category": "This listing is filed under the wrong category.",
  "prohibited-item": "This listing is for an item we do not allow.",
  "image-policy": "The photos do not meet our image guidelines.",
  duplicate: "This listing duplicates another one of yours.",
  other: "This listing does not meet our listing guidelines.",
};

/**
 * What the seller reads under "Suspended by moderation": the operator's note
 * when there is one, otherwise the slug's own sentence.
 *
 * `suspension_reason` is never null on a suspended row (the table constraint
 * requires it), so `admin_suspend_listing` stores the slug there when no note
 * was given. A reason equal to the slug is therefore the "no note" case.
 */
export function sellerSuspensionMessage(
  slug: string | null,
  reason: string | null,
): string {
  if (reason && reason !== slug) return reason;
  // Cast because both arguments are the raw column values, which are plain
  // text: the lookup is deliberately allowed to miss, and the `??` below is
  // what makes an unrecognised slug safe rather than the cast.
  return (
    SUSPENSION_REASON_SENTENCES[(slug ?? reason) as SuspensionSlug] ??
    SUSPENSION_REASON_SENTENCES.other
  );
}
