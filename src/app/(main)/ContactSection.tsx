import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PRIMARY_CTA_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

export default function ContactSection() {
  return (
    <section
      aria-labelledby="contact-headline"
      className="relative isolate overflow-hidden rounded-[2.1rem] border border-[#d4c2ad] bg-(--bg-cream) py-12 shadow-[0_22px_60px_rgba(109,82,47,0.10)] sm:py-16 lg:py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(216,181,134,0.28),transparent_55%),radial-gradient(circle_at_8%_92%,rgba(255,255,255,0.5),transparent_50%)]"
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 text-center sm:px-10 lg:px-14">
        <span
          aria-hidden
          className="mb-5 inline-flex size-12 items-center justify-center rounded-full border border-[#e0cfb6] bg-white/70 text-(--accent-deep)"
        >
          <MessageSquare className="size-5" />
        </span>
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-(--accent-deep)">
          We&apos;re listening
        </p>
        <h2
          id="contact-headline"
          className="mt-4 text-balance font-display text-[2.1rem] leading-[1.05] text-(--ink) sm:text-[2.6rem] lg:text-[3rem]"
        >
          Questions, feedback, or ideas?
        </h2>
        <Button
          asChild
          className={cn(PRIMARY_CTA_CLASS, "mt-8 h-12 w-full px-8 sm:w-auto")}
        >
          <Link href="/contact">Contact Us</Link>
        </Button>
      </div>
    </section>
  );
}
