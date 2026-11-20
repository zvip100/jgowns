import { handleRouterTransitionStart, initAnalytics } from "@/lib/analytics/client";
import { trackBrowseReturn } from "@/lib/browse-return";
import { startNavigationProgress } from "@/lib/navigation-progress";

// A Next framework file: it must sit at the root of src/, so it cannot be
// folded into a sibling module the way AGENTS.md §9 asks of small files.
initAnalytics();

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  handleRouterTransitionStart(url);
  startNavigationProgress(url);
  trackBrowseReturn(url, navigationType);
}
