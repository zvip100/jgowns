import { CONTACT_EMAIL } from "@/lib/site";
import { LEGAL_LINK_CLASS } from "@/lib/styles";

import ContactForm from "./ContactForm";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions, feedback, or ideas? Send us a note and we'll get back to you.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 text-center">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-(--accent-deep)">
          Get in touch
        </p>
        <h1 className="mt-4 font-display text-[2.1rem] text-(--ink) sm:text-[2.6rem]">
          Contact Us
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-(--muted-ink)">
          Questions, feedback, or ideas? Send a note below, or email us directly
          at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LEGAL_LINK_CLASS}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>

      <ContactForm />
    </div>
  );
}
