import { handleRouterTransitionStart, initAnalytics } from "@/lib/analytics/client";

// A Next framework file: it must sit at the root of src/, so it cannot be
// folded into a sibling module the way AGENTS.md §9 asks of small files.
initAnalytics();

export function onRouterTransitionStart(url: string): void {
  handleRouterTransitionStart(url);
}

