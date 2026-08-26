import { z } from "zod";

import { MAX_SUSPENSION_NOTE_LENGTH, SUSPENSION_SLUGS } from "@/lib/suspension";

/**
 * Shared by the admin server actions (the authority) and the suspend dialog
 * (inline field validation), so the rules and messages live once.
 */

/**
 * Ids arrive from a rendered page, so a bad one is a bug or a replay, not a
 * typo a seller can see. The message stays generic for that reason.
 */
export const adminListingIdSchema = z.uuid("Invalid listing id");

export const adminSizeIdSchema = z.uuid("Invalid size id");

export const suspendListingSchema = z.object({
  slug: z.enum(SUSPENSION_SLUGS, { error: "Choose a reason." }),
  /**
   * Trimmed to undefined rather than kept as "", so the RPC's own
   * "note when there is one, slug otherwise" fallback sees the same thing
   * whether the field was skipped or left blank.
   */
  note: z
    .string()
    .trim()
    .max(
      MAX_SUSPENSION_NOTE_LENGTH,
      `Keep the note under ${MAX_SUSPENSION_NOTE_LENGTH} characters.`,
    )
    .optional()
    .transform((value) => (value ? value : undefined)),
});

/**
 * The INPUT side deliberately: `note` is transformed, so the output type marks
 * the key required-but-possibly-undefined, which would force every caller to
 * pass `note: undefined` explicitly.
 */
export type SuspendListingInput = z.input<typeof suspendListingSchema>;

/**
 * A photo is identified by its stored URL, not by a bucket path: the RPC
 * resolves the path from the listing's own array, so a client-supplied path is
 * never reachable.
 */
export const removeListingImageSchema = z.object({
  listingId: adminListingIdSchema,
  imageUrl: z.url("Invalid image URL"),
});
