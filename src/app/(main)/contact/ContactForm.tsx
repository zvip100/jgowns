"use client";

import { useState } from "react";

import { TextInputField } from "@/components/form/TextInputField";
import { TextareaField } from "@/components/form/TextareaField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { submitContactMessage } from "@/lib/actions/contact";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";

export default function ContactForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await submitContactMessage(new FormData(event.currentTarget));
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <Alert
        className="border-green-200 bg-green-50 text-green-700"
        role="status"
      >
        <AlertDescription className="text-center text-green-700">
          Thanks, we received your message. We&apos;ll get back to you soon.
        </AlertDescription>
      </Alert>
    );
  }

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
        />
        <TextareaField
          id="message"
          name="message"
          label="Message"
          required
          rows={5}
          placeholder="How can we help?"
        />

        {/* Honeypot: hidden from real users; a filled value flags a bot. */}
        <div
          aria-hidden
          className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
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

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" disabled={pending} className={PRIMARY_CTA_CLASS}>
          {pending ? "Sending…" : "Send Message"}
        </Button>
      </FieldGroup>
    </form>
  );
}
