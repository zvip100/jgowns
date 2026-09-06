import { after } from "next/server";
import { PostHog } from "posthog-node";
import { z } from "zod";

import type { AnalyticsEventName, AnalyticsProperties } from "./events";

const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/** Groups a config alarm apart from a real exception (spec §2.4). */
export type ServerErrorKind = "exception" | "config";

export type ServerErrorContext = {
  /** Stable slug for the call site; becomes the issue's grouping handle. */
  scope: string;
  kind?: ServerErrorKind;
  properties?: AnalyticsProperties;
};

/**
 * A fresh client per call, shut down straight after. Both server surfaces
 * (exceptions and payment confirmations) are low volume, and the `Immediate`
 * calls already await the HTTP request, so a memoized client would only add a
 * teardown problem this app has no hook for. flushAt/flushInterval remain the
 * backstop for anything that still manages to queue.
 */
function createClient(): PostHog | null {
  if (!PROJECT_TOKEN || !API_HOST) return null;

  return new PostHog(PROJECT_TOKEN, {
    host: API_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Supabase and Stripe hand back plain objects rather than Errors, and PostHog
 * groups issues far better with a real message and stack than with a stringified
 * blob.
 */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;

  if (typeof value === "object" && value !== null && "message" in value) {
    return new Error(String((value as { message: unknown }).message));
  }
  return new Error(String(value));
}

/**
 * Runs the work after the response is sent, so reporting never sits in front of
 * the user. Returns false outside a request scope (tests, scripts), where the
 * caller has to await instead.
 */
function scheduleAfterResponse(task: () => Promise<void>): boolean {
  try {
    after(task);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reports to PostHog and nothing else. Never throws and never rejects, so no
 * call site has to guard it. Used where the caller already logged, which is
 * every path Next has printed to stdout itself.
 */
export async function captureServerException(
  error: unknown,
  properties?: AnalyticsProperties,
): Promise<void> {
  let client: PostHog | null = null;

  try {
    client = createClient();
    if (!client) return;

    // No distinctId: §2.1 keeps everything anonymous, and posthog-node then
    // mints a throwaway id and sets $process_person_profile false itself.
    await client.captureExceptionImmediate(toError(error), undefined, properties);
  } catch (captureError) {
    console.error("[analytics] failed to report a server exception:", captureError);
  } finally {
    await client?.shutdown().catch(() => {});
  }
}

/**
 * The catch blocks in `src/lib/actions/` swallow their error and return a typed
 * result, which is exactly what stops it reaching `onRequestError`. This logs to
 * stdout so Railway keeps the raw line, then reports the same error to PostHog
 * after the response. Never throws, never blocks the response.
 *
 * A ZodError is logged but not reported: at these sites it means a person
 * submitted something invalid and already saw an inline message, and filing
 * those buries real regressions under typos, exactly as §2.4 rules out for
 * user-caused auth failures. An uncaught ZodError that escapes to the framework
 * is a genuine fault, so `onRequestError` still reports it.
 */
export async function captureServerError(
  context: ServerErrorContext,
  error: unknown,
): Promise<void> {
  console.error(`[${context.scope}]`, error);

  if (error instanceof z.ZodError) return;

  const properties: AnalyticsProperties = {
    ...context.properties,
    scope: context.scope,
    kind: context.kind ?? "exception",
  };

  const report = () => captureServerException(error, properties);
  if (!scheduleAfterResponse(report)) await report();
}

async function sendServerEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): Promise<void> {
  let client: PostHog | null = null;

  try {
    client = createClient();
    if (!client) return;

    await client.captureImmediate({ event, properties });
  } catch (captureError) {
    console.error(`[analytics] failed to capture ${event}:`, captureError);
  } finally {
    await client?.shutdown().catch(() => {});
  }
}

/**
 * Anonymous, unstitched server event (spec §4). Stands alone as a count; it has
 * no browser session to join.
 *
 * Delivery goes through `after()` for the same reason error reporting does:
 * every call site sits on a critical path that ends in a redirect to Stripe, an
 * auth redirect, or a Stripe webhook's 200, and a blocking round-trip to PostHog
 * there buys nothing. Outside a request scope the send is awaited instead.
 */
export async function captureServerEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): Promise<void> {
  const send = () => sendServerEvent(event, properties);
  if (!scheduleAfterResponse(send)) await send();
}
