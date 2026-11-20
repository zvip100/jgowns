"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  getPreviousEntryUrl,
  readBrowseReturnPosition,
  setPendingBrowseRestore,
} from "@/lib/browse-return";
import { browseHrefFromBack } from "@/lib/browse-url";

type NavigateEvent = { preventDefault: () => void };

type BackLinkViewProps = {
  href: string;
  label: string;
  onNavigate?: (event: NavigateEvent) => void;
};

function BackLinkView({ href, label, onNavigate }: BackLinkViewProps) {
  return (
    <Link
      href={href}
      prefetch={true}
      onNavigate={onNavigate}
      className='mb-6 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#8a7462] hover:text-[#5a4537]'
    >
      <ChevronLeft data-icon='inline-start' />
      {label}
    </Link>
  );
}

type AllGownsLinkProps = {
  href: string;
};

/** Returns to the list where it was left: history-back when the list is the previous entry, otherwise a push that keeps the saved position. */
function AllGownsLink({ href }: AllGownsLinkProps) {
  const router = useRouter();

  function handleNavigate(event: NavigateEvent): void {
    const saved = readBrowseReturnPosition();
    const scrollY =
      saved &&
      saved.detailPath === window.location.pathname &&
      browseHrefFromBack(saved.search) === href
        ? saved.scrollY
        : null;
    const previous = getPreviousEntryUrl();

    if (previous?.pathname === "/browse" && browseHrefFromBack(previous.search) === href) {
      event.preventDefault();
      if (scrollY !== null) setPendingBrowseRestore({ href, scrollY, isFreshOnly: true });
      router.back();
      return;
    }
    if (scrollY === null) return;

    event.preventDefault();
    // The push clears any pending restore as it starts, so the restore is set after it.
    router.push(href, { scroll: false });
    setPendingBrowseRestore({ href, scrollY, isFreshOnly: false });
  }

  return <BackLinkView href={href} label='All gowns' onNavigate={handleNavigate} />;
}

function BackLinkFromParams() {
  const searchParams = useSearchParams();
  if (searchParams.get("from") === "dash") {
    return <BackLinkView href='/dashboard' label='Back to dashboard' />;
  }
  return <AllGownsLink href={browseHrefFromBack(searchParams.get("back") ?? undefined)} />;
}

/** Reads the URL on the client so it renders in the loading shell, before the listing resolves. */
export function BackLink() {
  return (
    <Suspense fallback={<BackLinkView href='/browse' label='All gowns' />}>
      <BackLinkFromParams />
    </Suspense>
  );
}
