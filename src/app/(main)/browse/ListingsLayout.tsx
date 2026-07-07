"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { countActiveBrowseFilters } from "@/lib/browse-params";
import { cn } from "@/lib/utils";

import FilterBar from "./FilterBar";
import FilterCountBadge from "./FilterCountBadge";

const STICKY_BAR_CHROME =
  "border-[#d5c4b0] bg-[rgba(252,246,236,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-lg";

type ListingsLayoutProps = {
  minBound: number;
  maxBound: number;
  categoryNavMobile: ReactNode;
  categoryNavDesktop: ReactNode;
  listings: ReactNode;
};

export default function ListingsLayout({
  minBound,
  maxBound,
  categoryNavMobile,
  categoryNavDesktop,
  listings,
}: ListingsLayoutProps) {
  // The open rail visually extends the desktop subnav downward.
  const [railOpen, setRailOpen] = useState(true);
  const [mobileStuck, setMobileStuck] = useState(false);
  const mobileStickyRef = useRef<HTMLDivElement | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);
  const params = useSearchParams();

  const activeFilterCount = countActiveBrowseFilters(params);

  /**
   * Snap the layout to its final state and let the View Transitions API
   * animate the difference (cards glide, rail slides in — see globals.css).
   * `flushSync` commits the React update inside the callback so the browser
   * snapshots the correct "after" state. Falls back to an instant toggle.
   */
  const toggleRail = (open: boolean) => {
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setRailOpen(open);
      return;
    }
    document.startViewTransition(() => {
      flushSync(() => setRailOpen(open));
    });
  };

  // Detect when the mobile bar sticks so chrome appears only while pinned.
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
      <div
        ref={mobileSentinelRef}
        aria-hidden
        className='h-px w-full lg:hidden'
      />
      <div
        ref={mobileStickyRef}
        className={cn(
          "sticky top-(--navbar-h) z-40 -mx-4 border-b border-transparent px-4 pt-3 pb-2 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ease-out sm:-mx-6 sm:px-6 lg:hidden",
          mobileStuck && STICKY_BAR_CHROME
        )}
      >
        <div className='flex items-center gap-3'>
          <FilterBar variant='drawer' minBound={minBound} maxBound={maxBound} />
          <div className='min-w-0 flex-1'>{categoryNavMobile}</div>
        </div>
      </div>

      {/* Sticky outer keeps the subnav pinned; full-width inner lets its background
          cover the sliding rail while content stays aligned to the page frame. */}
      <div className='sticky top-(--navbar-h) z-40 hidden lg:block'>
        {/* The transition name sits on the blurred element itself — naming an
            ancestor isolates the subtree and kills the backdrop-filter frost. */}
        <div
          className={cn(
            "relative left-1/2 -ml-[50vw] w-screen border-b",
            STICKY_BAR_CHROME,
          )}
          style={{ viewTransitionName: "browse-subnav" }}
        >
          <div className='mx-auto flex h-(--listings-subnav-h) w-full max-w-375 min-w-0 items-center gap-4 px-4 sm:px-6 lg:px-10'>
            {!railOpen && (
              <Button
                type='button'
                variant='outline'
                onClick={() => toggleRail(true)}
                aria-expanded={false}
                aria-controls='listings-filter-rail'
                style={{ viewTransitionName: "rail-toggle" }}
                className='group/sub-toggle h-auto w-72 shrink-0 justify-between rounded-full border-[#c9b39a] bg-white/85 px-4 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-[#6f5947] shadow-[0_10px_26px_rgba(97,71,42,0.14)] backdrop-blur-sm hover:bg-white'
              >
                <span className='inline-flex items-center gap-2'>
                  <SlidersHorizontal data-icon='inline-start' />
                  <span>Show Filters</span>
                </span>
                <span className='inline-flex items-center gap-2'>
                  <FilterCountBadge count={activeFilterCount} />
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

      {/* `overflow-x: clip` hides the collapsed rail's content without creating
          the scroll container that would break the FilterBar sticky anchor. */}
      <div
        className={cn(
          "lg:grid lg:pt-0",
          railOpen
            ? "lg:gap-x-6 xl:gap-x-7 lg:grid-cols-[18rem_minmax(0,1fr)]"
            : "lg:gap-x-0 lg:grid-cols-[0_minmax(0,1fr)]"
        )}
      >
        {/* Keep the aside itself stretched; an inner wrapper would shrink-wrap
            the rail and remove sticky's scroll room. */}
        <aside
          id='listings-filter-rail'
          inert={!railOpen}
          className={cn(
            "hidden min-w-0 lg:block lg:overflow-x-clip",
            railOpen ? "lg:opacity-100" : "lg:opacity-0"
          )}
          style={{ viewTransitionName: railOpen ? "filter-rail" : "none" }}
        >
          <FilterBar
            variant='rail'
            minBound={minBound}
            maxBound={maxBound}
            onCollapseRail={() => setRailOpen(false)}
          />
        </aside>

        <div className='min-w-0 pt-0 lg:pt-3'>{listings}</div>
      </div>
    </>
  );
}
