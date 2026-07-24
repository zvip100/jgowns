import { z } from "zod";

/** Shared by the contact server action (authority) and the contact form
 * (inline client-side field validation), so the rules and messages live once. */
export const contactSchema = z.object({
  email: z.email("Enter a valid email address."),
  message: z
    .string()
    .trim()
    .min(10, "Your message must be at least 10 characters.")
    .max(2000, "Your message must be less than 2,000 characters."),
});

export type ContactFieldName = keyof z.infer<typeof contactSchema>;
