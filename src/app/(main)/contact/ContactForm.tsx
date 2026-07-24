"use client";

import { useState } from "react";

import { TextInputField } from "@/components/form/TextInputField";
import { TextareaField } from "@/components/form/TextareaField";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { submitContactMessage } from "@/lib/actions/contact";
import {
  contactSchema,
  type ContactFieldName,
} from "@/lib/validations/contact-schema";
import { toast } from "@/lib/toast";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";

import type { SubmitEvent } from "react";

type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;

export default function ContactForm() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ContactFieldErrors>({});

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // Field-level validation stays inline; only the submit outcome toasts.
    const parsed = contactSchema.safeParse({
      email: formData.get("email") ?? "",
      message: formData.get("message") ?? "",
    });
    
    if (!parsed.success) {
      const fieldErrors: ContactFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          (field === "email" || field === "message") &&
          !fieldErrors[field]
        ) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const result = await submitContactMessage(formData);
      if (result.success) {
        form.reset();
        toast.success("Message sent successfully");
      } else {
        toast.error("Failed to send message", { description: result.error });
      }
    } catch {
      toast.error("Failed to send message", {
        description: "Please try again in a moment.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="surface-panel hairline rounded-[1.7rem] p-6 sm:p-8"
    >
      <FieldGroup>
        <TextInputField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          error={errors.email}
        />
        <TextareaField
          id="message"
          name="message"
          label="Message"
          required
          rows={5}
          placeholder="How can we help?"
          error={errors.message}
        />

        {/* Honeypot: hidden from real users; a filled value flags a bot. */}
        <div
          aria-hidden
          className="absolute -left-2499.75 h-0 w-0 overflow-hidden"
        >
          <label htmlFor="company">Company</label>
          <input
            id="company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <Button type="submit" disabled={pending} className={PRIMARY_CTA_CLASS}>
          {pending ? "Sending…" : "Send Message"}
        </Button>
      </FieldGroup>
    </form>
  );
}
