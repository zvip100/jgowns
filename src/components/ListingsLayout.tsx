"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import FilterBar from "@/components/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BROWSE_FILTER_PARAMS } from "@/lib/browse-params";
import { cn } from "@/lib/utils";

type ListingsLayoutProps = {
  minBound: number;
  maxBound: number;
  /** Server-rendered category chips (mobile strip) */
  categoryNavMobile: ReactNode;
  /** Server-rendered category chips (desktop sub-navbar) */
  categoryNavDesktop: ReactNode;
  /** Count + grid (Suspense-wrapped on browse page) */
  listings: ReactNode;
};

export default function ListingsLayout({
  minBound,
  maxBound,
  categoryNavMobile,
  categoryNavDesktop,
  listings,
}: ListingsLayoutProps) {
  // Filters open by default — the sub-navbar then "extends" downward into
  // the rail. Toggling collapses the rail back behind the sub-navbar.
  const [railOpen, setRailOpen] = useState(true);
  const [mobileStuck, setMobileStuck] = useState(false);
  const mobileStickyRef = useRef<HTMLDivElement | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);
  const params = useSearchParams();

  const activeFilterCount = BROWSE_FILTER_PARAMS.filter((k) =>
    params.has(k),
  ).length;

  // Toggle `mobileStuck` when the mobile bar pins below the navbar.
  useEffect(() => {
    const sticky = mobileStickyRef.current;
    const sentinel = mobileSentinelRef.current;
    if (!sticky || !sentinel) return;

    let observer: IntersectionObserver | null = null;
    const setup = () => {
      observer?.disconnect();
      const top = parseFloat(window.getComputedStyle(sticky).top) || 0;
      observer = new IntersectionObserver(
        ([entry]) => setMobileStuck(!entry.isIntersecting),
        { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: [0, 1] }
      );
      observer.observe(sentinel);
    };

    setup();
    window.addEventListener("resize", setup);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", setup);
    };
  }, []);

  return (
    <>
      {/* MOBILE: sticky filter trigger that styles itself only when pinned. */}
      <div
        ref={mobileSentinelRef}
        aria-hidden
        className='h-px w-full lg:hidden'
      />
      <div
        ref={mobileStickyRef}
        className={cn(
          "sticky top-(--navbar-h) z-40 -mx-4 mb-5 border-b border-transparent px-4 py-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ease-out sm:-mx-6 sm:px-6 lg:hidden",
          mobileStuck &&
          "border-[#d5c4b0] bg-[rgba(252,246,236,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-lg"
        )}
      >
        <div className='-mx-4 mb-4 border-b border-[#e8dcc8]/90 px-4 pb-4 sm:-mx-6 sm:px-6'>
          {categoryNavMobile}
        </div>
        <FilterBar variant='drawer' minBound={minBound} maxBound={maxBound} />
      </div>

      {/* DESKTOP — Secondary sub-navbar.
          Always visible on lg+; pinned flush below the global navbar so it
          reads as a second header tier specific to this page.

          Two-layer trick: the OUTER div is `position: sticky` (which only
          works on a normally-flowed element), and the INNER div uses
          `relative; left: 50%; -ml-[50vw]; w-screen` to escape <main>'s
          1440px max-width and bleed its cream BG to both viewport edges —
          exactly like the global header.           Inner content is then re-centered
          to the same max-w-375 frame so the category row aligns with the
          cards/rail beneath it.

          z-40 is one notch below the global navbar (z-50) and one above the
          rail (z-30) — so when the rail slides up on collapse it tucks
          neatly behind this strip's cream BG. */}
      <div className='sticky top-(--navbar-h) z-40 hidden lg:block'>
        <div className='relative left-1/2 -ml-[50vw] w-screen border-b border-[#d5c4b0] bg-[rgba(252,246,236,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-lg'>
          <div className='mx-auto flex h-(--listings-subnav-h) w-full max-w-375 min-w-0 items-center gap-4 px-4 sm:px-6 lg:px-10'>
            {/* Rail open by default; the panel has its own collapse control.
                Only render this trigger when the rail is closed so users can
                reopen it without redundant "Hide" next to the sidebar. */}
            {!railOpen && (
              <Button
                type='button'
                variant='outline'
                onClick={() => setRailOpen(true)}
                aria-expanded={false}
                aria-controls='listings-filter-rail'
                className='group/sub-toggle h-auto w-72 shrink-0 justify-between rounded-full border-[#c9b39a] bg-white/85 px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-[#6f5947] shadow-[0_10px_26px_rgba(97,71,42,0.14)] backdrop-blur-sm hover:bg-white'
              >
                <span className='inline-flex items-center gap-2'>
                  <SlidersHorizontal data-icon='inline-start' />
                  <span>Show Filters</span>
                </span>
                <span className='inline-flex items-center gap-2'>
                  {activeFilterCount > 0 && (
                    <Badge
                      variant='outline'
                      className='rounded-full border-0 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-2 py-0 text-[0.6rem] font-semibold leading-5 text-white shadow-[0_4px_12px_rgba(166,120,65,0.35)]'
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                  <ChevronDown
                    data-icon='inline-end'
                    className='transition-transform duration-500 ease-out'
                  />
                </span>
              </Button>
            )}
            <div className='min-h-0 min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
              {categoryNavDesktop}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP grid — rail | cards.
          Column 1 animates between `18rem` and `0`; the rail itself fades
          and slides HORIZONTALLY out to the left (and back in from the
          left) — the visual the user wants. `overflow-x: clip` on the
          aside clips the inner 18rem panel during the width transition
          without establishing a scroll container — so the FilterBar's
          `position: sticky` continues to anchor to the viewport, not to
          the aside. Cards expand to fill the freed space when the rail
          closes. `lg:pt-0` keeps the rail (and count row) flush against
          the sub-navbar's bottom edge so they read as directly connected. */}
      <div
        className={cn(
          "lg:grid lg:transition-[grid-template-columns,column-gap] lg:duration-700 lg:ease-[cubic-bezier(0.22,1,0.36,1)] lg:pt-0",
          railOpen
            ? "lg:gap-x-6 xl:gap-x-7 lg:grid-cols-[18rem_minmax(0,1fr)]"
            : "lg:gap-x-0 lg:grid-cols-[0_minmax(0,1fr)]"
        )}
      >
        {/* Opacity/translate live on the <aside> ITSELF (not on an inner
            wrapper). Reason: `position: sticky` requires its parent to be
            taller than the sticky element so it has room to slide. The aside
            is a grid item with default `align-self: stretch`, so it inherits
            the row height (= the much taller cards column) — giving the
            FilterBar's sticky a tall scroll window to anchor against. An
            inner wrapper would shrink-wrap the panel and kill sticky.
            Transform on the aside is fine: per CSS spec, `transform` only
            establishes a containing block for FIXED/ABSOLUTE descendants,
            not for STICKY ones. */}
        <aside
          id='listings-filter-rail'
          aria-hidden={!railOpen}
          className={cn(
            "hidden min-w-0 lg:block lg:overflow-x-clip lg:transition-[opacity,transform] lg:duration-700 lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
            // Closed: slide one full rail-width to the LEFT (-18rem === w-72)
            // and fade out — body's `overflow-x: clip` swallows the off-screen
            // bleed. Re-opening reverses it (slides in from the left, fades).
            railOpen
              ? "lg:opacity-100"
              : "lg:pointer-events-none lg:opacity-0 lg:-translate-x-72"
          )}
        >
          <FilterBar
            variant='rail'
            minBound={minBound}
            maxBound={maxBound}
            onCollapseRail={() => setRailOpen(false)}
          />
        </aside>

        <div className='min-w-0 pt-2 lg:pt-3'>{listings}</div>
      </div>
    </>
  );
}
