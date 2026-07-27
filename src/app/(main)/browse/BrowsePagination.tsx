import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import {
  browsePageHref,
  getBrowsePageNavItems,
} from "@/lib/browse-pagination";
import type { PageSearchParams } from "@/lib/types";
import { cn } from "@/lib/utils";

type BrowsePaginationProps = {
  page: number;
  totalPages: number;
  searchParams: PageSearchParams;
};

const navLinkBase =
  "inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-[#6f5947] transition-colors hover:text-[#3f3023] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

const pageLinkBase =
  "inline-flex min-h-8 min-w-8 items-center justify-center text-sm tabular-nums text-[#8e7962] transition-colors hover:text-[#3f3023] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

const pageLinkActive =
  "font-semibold text-[#3f3023] underline decoration-[#c9a880] decoration-2 underline-offset-[0.35rem] hover:text-[#3f3023]";

export default function BrowsePagination({
  page,
  totalPages,
  searchParams,
}: BrowsePaginationProps) {
  if (totalPages <= 1) return null;

  const navItems = getBrowsePageNavItems(page, totalPages);
  const prevHref = page > 1 ? browsePageHref(searchParams, page - 1) : null;
  const nextHref =
    page < totalPages ? browsePageHref(searchParams, page + 1) : null;

  return (
    <nav
      aria-label='Browse results pages'
      className='mt-10 border-t border-[#e6d8c3]/80 pt-8'
    >
      <ul className='flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-3'>
        <li>
          {prevHref ? (
            <Link
              href={prevHref}
              scroll
              className={navLinkBase}
              aria-label='Previous page'
            >
              <ChevronLeft className='size-4 shrink-0' strokeWidth={2} />
              <span className='hidden sm:inline'>Previous</span>
            </Link>
          ) : (
            <span
              className={cn(navLinkBase, "pointer-events-none opacity-35")}
              aria-disabled
            >
              <ChevronLeft className='size-4 shrink-0' strokeWidth={2} />
              <span className='hidden sm:inline'>Previous</span>
            </span>
          )}
        </li>

        {navItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <li
                key={`ellipsis-${index}`}
                className='flex min-h-8 min-w-6 items-center justify-center text-[#bca88f]'
                aria-hidden
              >
                <MoreHorizontal className='size-4' strokeWidth={1.5} />
                <span className='sr-only'>More pages</span>
              </li>
            );
          }

          const href = browsePageHref(searchParams, item);
          const isActive = item === page;

          return (
            <li key={item}>
              <Link
                href={href}
                scroll
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={cn(pageLinkBase, isActive && pageLinkActive)}
              >
                {item}
              </Link>
            </li>
          );
        })}

        <li>
          {nextHref ? (
            <Link
              href={nextHref}
              scroll
              prefetch
              className={navLinkBase}
              aria-label='Next page'
            >
              <span className='hidden sm:inline'>Next</span>
              <ChevronRight className='size-4 shrink-0' strokeWidth={2} />
            </Link>
          ) : (
            <span
              className={cn(navLinkBase, "pointer-events-none opacity-35")}
              aria-disabled
            >
              <span className='hidden sm:inline'>Next</span>
              <ChevronRight className='size-4 shrink-0' strokeWidth={2} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
