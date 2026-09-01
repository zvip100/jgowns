import { z } from "zod";

import { MAX_SUSPENSION_NOTE_LENGTH, SUSPENSION_SLUGS } from "@/lib/suspension";
import {
  ACCEPTED_LISTING_IMAGE_TYPES,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
} from "@/lib/types";

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
 * never reachable. Shared by both photo actions, remove and reprocess.
 */
export const listingImageTargetSchema = z.object({
  listingId: adminListingIdSchema,
  imageUrl: z.url("Invalid image URL"),
});

/**
 * The photo an operator picks in the add or replace dialog. Shared by the two
 * actions (the authority) and the dialog's own inline field error, so the rules
 * and the wording live once.
 *
 * `z.instanceof(File)` works on both sides: File is global in the browser and
 * in the Node 18+ server runtime.
 */
export const listingImageFileSchema = z
  .instanceof(File, { error: "Choose a photo." })
  .refine(
    (file) =>
      (ACCEPTED_LISTING_IMAGE_TYPES as readonly string[]).includes(file.type),
    "Upload a JPEG, PNG, or WebP image.",
  )
  .refine(
    (file) => file.size > 0 && file.size <= MAX_LISTING_IMAGE_BYTES,
    `Keep the photo under ${MAX_LISTING_IMAGE_MB} MB.`,
  );

/**
 * A reorder is addressed by POSITION plus the URL the operator's page believes
 * is there, not by URL alone: two identical URLs in one array are reachable, and
 * the database has to move the thumbnail that was clicked. `position` is 1-based
 * to match the RPC's own array indexing.
 */
export const listingImageMoveSchema = z.object({
  listingId: adminListingIdSchema,
  imageUrl: z.url("Invalid image URL"),
  position: z.number().int().min(1).max(MAX_LISTING_IMAGES),
  offset: z.union([z.literal(-1), z.literal(1)]),
});
