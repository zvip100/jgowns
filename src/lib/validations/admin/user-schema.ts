import { z } from "zod";

/** Shared by the admin user actions and the ban / delete confirm dialogs. */

export const adminUserIdSchema = z.uuid("Invalid user id");

export const banUserSchema = z.object({
  userId: adminUserIdSchema,
  /**
   * Ban and sweep are one operator action but two systems, so this is a flag on
   * the ban rather than a second call: GoTrue and Postgres share no
   * transaction, and the action reports on each half separately.
   */
  sweepListings: z.boolean().default(true),
});

export type BanUserInput = z.infer<typeof banUserSchema>;

/**
 * What the ban button hands the action. Kept separate from `BanUserInput` (the
 * schema's OUTPUT, where `sweepListings` is always present) because the caller
 * may omit the flag and the schema is what fills it in.
 */
export type BanUserOptions = { sweepListings?: boolean };

/** Supabase writes a far-future timestamp for an indefinite ban. */
export const BAN_DURATION = "876000h";
export const UNBAN_DURATION = "none";

/**
 * The sweep's moderation reason. Taxonomy has no seller-level slug, so the ban
 * travels as the note, which is what the seller reads on each swept listing.
 */
export const BAN_SWEEP_SLUG = "other";
export const BAN_SWEEP_NOTE = "The seller account was banned.";
