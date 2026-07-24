import { z } from "zod";

import { isValidSizePair } from "@/lib/gown-sizes";
import {
  CONTACT_METHODS,
  GOWN_CATEGORIES,
  SELL_MODES,
  SIZE_GROUPS,
  type GownCategoryId,
} from "@/lib/types";
import { optionalPhoneSchema } from "@/lib/utils";

const CATEGORY_IDS = GOWN_CATEGORIES.map((c) => c.id) as [
  GownCategoryId,
  ...GownCategoryId[],
];

const sizeEntrySchema = z.object({
  size: z.string().trim().min(1, "Choose a size for every row."),
  size_group: z.enum(SIZE_GROUPS, { error: "Choose a size for every row." }),
  // Omitted for set-only listings; required for every other mode (see superRefine).
  price: z.coerce
    .number({ error: "Enter a price for every size." })
    .positive("Enter a price for every size.")
    .optional(),
});

/** Shared by the sell server action (authority) and the listing form (inline
 * client-side field validation), so the rules and messages live once. */
export const listingInputSchema = z
  .object({
    title: z.string().trim().min(4, "Enter a title of at least 4 characters."),
    description: z.string().trim().optional(),
    color: z.string().trim().optional(),
    location: z.string().trim().min(1, "Choose your location."),
    condition: z.string().trim().min(1, "Choose a condition."),
    category: z.enum(CATEGORY_IDS, { error: "Choose a category." }),
    sizes: z.array(sizeEntrySchema).min(1),
    sell_mode: z.enum(SELL_MODES).default("individual"),
    bundle_price: z.coerce.number().positive().optional(),
    contact_email: z
      .email("Enter a valid email address, or clear the field.")
      .optional(),
    contact_phone: optionalPhoneSchema,
    contact_methods: z.array(z.enum(CONTACT_METHODS)).default([]),
    status: z.enum(["active", "sold", "removed"]).default("active"),
  })
  .superRefine((data, ctx) => {
    if (!data.contact_email && !data.contact_phone) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_email"],
        message: "Add an email or phone number so buyers can reach you.",
      });
    }
    if (data.contact_methods.length > 0 && !data.contact_phone) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_methods"],
        message: "Add a phone number to offer call or text.",
      });
    }
    const seen = new Set<string>();
    for (const [i, entry] of data.sizes.entries()) {
      if (!isValidSizePair(data.category, entry.size_group, entry.size)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", i, "size"],
          message: "Size is not valid for this category.",
        });
      }
      const key = `${entry.size_group}:${entry.size}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", i, "size"],
          message: "Each size can only be added once.",
        });
      }
      seen.add(key);
    }
    if (data.sell_mode !== "individual" && data.sizes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["sell_mode"],
        message: "Set pricing requires at least two sizes.",
      });
    }
    if (data.sell_mode !== "set_only") {
      for (const [i, entry] of data.sizes.entries()) {
        if (entry.price == null) {
          ctx.addIssue({
            code: "custom",
            path: ["sizes", i, "price"],
            message: "Enter a price for every size.",
          });
        }
      }
    }
    if (data.sell_mode === "individual" && data.bundle_price != null) {
      ctx.addIssue({
        code: "custom",
        path: ["bundle_price"],
        message: "A set price is only allowed when selling sizes together.",
      });
    }
    if (data.sell_mode === "set_only" && data.bundle_price == null) {
      ctx.addIssue({
        code: "custom",
        path: ["bundle_price"],
        message: "Enter the price for the complete set.",
      });
    }
  });

export type ParsedListing = z.infer<typeof listingInputSchema>;
