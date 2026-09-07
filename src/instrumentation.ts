import { assertServerEnv } from "@/lib/env";

import type { Instrumentation } from "next";

// A Next framework file: it must sit at the root of src/, so it cannot be
// folded into a sibling module the way AGENTS.md §9 asks of small files.
export function register(): void {
  // Edge bundles inline only statically-referenced env vars, so a dynamic
  // lookup there would report every variable as missing.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  assertServerEnv();
}

/**
 * Everything that escapes to the framework: route handlers, server actions, and
 * rendering. Next filters its own control-flow throws (redirect, notFound) out
 * before this runs. Errors an action catches never arrive here, which is what
 * `captureServerError` covers instead. Imported lazily so `posthog-node` stays
 * out of the edge bundle.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { captureServerException } = await import("@/lib/analytics/server");

  // Next has already logged this error, so reporting it is all that is left.
  await captureServerException(error, {
    scope: "next.onRequestError",
    kind: "exception",
    path: request.path,
    method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
  });
};
