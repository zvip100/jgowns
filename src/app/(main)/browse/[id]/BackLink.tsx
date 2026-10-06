"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { browseHrefFromBack } from "@/lib/browse-url";

type BackLinkViewProps = {
  href: string;
  label: string;
};

function BackLinkView({ href, label }: BackLinkViewProps) {
  return (
    <Link
      href={href}
      prefetch={true}
      className='mb-6 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:text-[#5a4537]'
    >
      <ChevronLeft data-icon='inline-start' />
      {label}
    </Link>
  );
}

function BackLinkFromParams() {
  const searchParams = useSearchParams();
  if (searchParams.get("from") === "dash") {
    return <BackLinkView href='/dashboard' label='Back to dashboard' />;
  }
  return (
    <BackLinkView
      href={browseHrefFromBack(searchParams.get("back") ?? undefined)}
      label='All gowns'
    />
  );
}

/** Reads the URL on the client so it renders in the loading shell, before the listing resolves. */
export function BackLink() {
  return (
    <Suspense fallback={<BackLinkView href='/browse' label='All gowns' />}>
      <BackLinkFromParams />
    </Suspense>
  );
}
