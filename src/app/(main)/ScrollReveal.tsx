"use client";

import { useEffect, useRef, useState } from "react";

import type { ReactNode } from "react";

type ScrollRevealState = "idle" | "armed" | "revealed";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Reveals its `reveal-item` / `reveal-rail` / `reveal-divider` descendants when
 * the wrapper scrolls into view. Uses IntersectionObserver rather than CSS
 * `animation-timeline: view()` so the reveals run in every browser, not just
 * Chromium. Only use it on below-the-fold content: the idle to armed hide would
 * flash above the fold (use a load-time animation there). Children render normally
 * until JS arms the wrapper, so no-JS / pre-hydration paints show real content.
 */
export default function ScrollReveal({ children, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ScrollRevealState>("idle");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("revealed");
      return;
    }

    // Already in view on load (short hero / tall viewport): reveal without the
    // idle -> armed hide, which would fade the content out on screen first.
    if (node.getBoundingClientRect().top < window.innerHeight) {
      setState("revealed");
      return;
    }

    setState("armed");

    // Trigger at ~65% down the viewport (rootMargin -35%) rather than the
    // bottom edge, so the cascade has scroll room to complete before the
    // reader reaches the section.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setState("revealed");
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -35% 0px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={state === "idle" ? undefined : state}
      className={className}
    >
      {children}
    </div>
  );
}
