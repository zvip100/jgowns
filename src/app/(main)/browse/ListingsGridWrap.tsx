"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/** Must match `minmax(15rem, …)` / `minmax(…, 18rem)` on the grid. */
const MIN_TRACK_REM = 15;
const MAX_TRACK_REM = 18;

type ListingsGridWrapProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Full-width outer layer measures available width; inner grid gets a computed
 * column count, fixed pixel width, and `mx-auto` so sparse rows align like a
 * full centered row (empty tracks on the right, not re-centered as a short clump).
 */
export default function ListingsGridWrap({
  children,
  className,
}: ListingsGridWrapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const lastLayoutRef = useRef<{ cols: number; widthPx: number } | null>(null);
  const [layout, setLayout] = useState<{
    cols: number;
    widthPx: number;
  } | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const inner = innerRef.current;
    if (!shell || !inner) return;

    const applyIfChanged = (cols: number, widthPx: number) => {
      const last = lastLayoutRef.current;
      if (last?.cols === cols && last.widthPx === widthPx) return;
      lastLayoutRef.current = { cols, widthPx };
      setLayout({ cols, widthPx });
    };

    const measure = () => {
      const W = shell.clientWidth;
      if (W <= 0) return;

      const innerCs = getComputedStyle(inner);
      const gapPx =
        parseFloat(innerCs.columnGap || innerCs.gap || "0") || 0;
      const rootFont =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const minPx = MIN_TRACK_REM * rootFont;
      const maxPx = MAX_TRACK_REM * rootFont;

      const cols = Math.max(
        1,
        Math.floor((W + gapPx) / (minPx + gapPx)),
      );
      const totalGap = (cols - 1) * gapPx;
      const rawTrack = (W - totalGap) / cols;
      const trackPx = Math.min(maxPx, Math.max(minPx, rawTrack));
      const widthPx = Math.round(cols * trackPx + totalGap);

      applyIfChanged(cols, widthPx);
    };

    /** One measure per frame — avoids thrashing during the rail width transition. */
    const scheduleMeasure = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        measure();
      });
    };

    measure();

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(shell);

    const mql = window.matchMedia("(min-width: 640px)");
    const onBp = () => scheduleMeasure();
    mql.addEventListener("change", onBp);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      mql.removeEventListener("change", onBp);
    };
  }, []);

  return (
    <div ref={shellRef} className='w-full min-w-0'>
      <div
        ref={innerRef}
        className={cn(
          "grid min-w-0 gap-4 sm:gap-5",
          layout
            ? "mx-auto max-w-full"
            : "w-full grid-cols-[repeat(auto-fit,minmax(15rem,18rem))]",
          className,
        )}
        style={
          layout
            ? {
                width: layout.widthPx,
                gridTemplateColumns: `repeat(${layout.cols}, minmax(15rem, 18rem))`,
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
