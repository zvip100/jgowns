"use client";

import { useLayoutEffect, useRef } from "react";

import { takePendingBrowseRestore } from "@/lib/browse-return";

type BrowseScrollRestorerProps = {
  href: string;
};

/** Scrolls the list back to where a gown was opened from it, once the grid is mounted. */
export default function BrowseScrollRestorer({ href }: BrowseScrollRestorerProps): null {
  const isFreshRef = useRef(true);

  useLayoutEffect(() => {
    const isFresh = isFreshRef.current;
    isFreshRef.current = false;
    const scrollY = takePendingBrowseRestore(href, isFresh);
    if (scrollY === null || Math.abs(window.scrollY - scrollY) <= 1) return;
    window.scrollTo(0, scrollY);
  }, [href]);

  return null;
}
