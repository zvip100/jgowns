"use server";

import { createClient } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validations/contact-schema";

export type ContactActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Notify us of a new contact message via Formspree. Best-effort: the DB row is
 * the source of truth, so a Formspree failure is logged but never fails the
 * submission. Called server-side so the endpoint stays out of the client bundle.
 */
async function sendContactNotification(
  email: string,
  message: string,
): Promise<void> {
  const endpoint = process.env.FORMSPREE_CONTACT_ENDPOINT;
  if (!endpoint) {
    console.error("FORMSPREE_CONTACT_ENDPOINT is not set; skipping email.");
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, message }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("Formspree notification failed with status:", response.status);
    }
  } catch (error) {
    console.error("Formspree notification error:", error);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Capture a contact-form submission into `contact_messages` (write-only table),
 * then notify us by email via Formspree. Works without a session so anonymous
 * buyers can reach us.
 *
 * No cache invalidation: nothing in the app reads `contact_messages`, so there
 * is no tag to invalidate.
 */
export async function submitContactMessage(
  formData: FormData,
): Promise<ContactActionResult> {
  // Honeypot: a hidden field real users never fill. If a bot filled it, report
  // success without inserting so it learns nothing.
  const honeypot = formData.get("company");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { success: true };
  }

  const parsed = contactSchema.safeParse({
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check your details and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    email: parsed.data.email,
    message: parsed.data.message,
  });

  if (error) {
    console.error("Failed to store contact message:", error);
    return {
      success: false,
      error: "We couldn't send your message. Please try again in a moment.",
    };
  }

  await sendContactNotification(parsed.data.email, parsed.data.message);

  return { success: true };
}
