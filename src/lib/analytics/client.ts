import posthog from "posthog-js";

import { POSTHOG_UI_HOST } from "@/lib/site";

import type { AnalyticsEventName, AnalyticsProperties } from "./events";
import type { BeforeSendFn } from "posthog-js";

const PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Matches the real admin route table without swallowing a future `/administration`,
 * mirroring `safePostAuthPath`'s pattern rather than a bare `startsWith`.
 */
const ADMIN_PATH_PATTERN = /^\/admin(\/|$)/;

/** True for an `/admin` URL, absolute or relative. Never throws on junk input. */
export function isAdminAnalyticsUrl(url: unknown): boolean {
  if (typeof url !== "string" || url === "") return false;

  try {
    return ADMIN_PATH_PATTERN.test(new URL(url, "http://localhost").pathname);
  } catch {
    return false;
  }
}

/**
 * No analytics events on `/admin`, but exceptions still report (spec §2.6).
 * The path comes off the event, never `window.location`: a queued event can be
 * sent after a client-side navigation has already changed the URL, which would
 * judge it against the wrong page in both directions.
 */
export const dropAdminAnalytics: BeforeSendFn = (cr) => {
  if (!cr) return cr;
  if (cr.event === "$exception") return cr;

  return isAdminAnalyticsUrl(cr.properties?.$current_url) ? null : cr;
};

/**
 * Missing config is a no-op, never a crash, but never a silent one either:
 * development says exactly which variable is unset, production stays quiet.
 */
function warnMissingConfig(name: string): void {
  if (process.env.NODE_ENV === "production") return;

  console.error(
    `${name} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${name} is configured`,
  );
}

export function isAnalyticsEnabled(): boolean {
  return posthog.__loaded === true;
}

/**
 * Both the token and the host gate `init`. Sending to PostHog's default host
 * when the proxy subdomain is unset would silently ship data to the wrong
 * region, which is worse than not sending it.
 */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;

  if (!PROJECT_TOKEN) warnMissingConfig("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
  if (!API_HOST) warnMissingConfig("NEXT_PUBLIC_POSTHOG_HOST");
  if (!PROJECT_TOKEN || !API_HOST || isAnalyticsEnabled()) return;

  // This runs before hydration, so a throw here would take the app down with
  // it. Next's own instrumentation-client guidance is to catch and carry on.
  try {
    posthog.init(PROJECT_TOKEN, {
      api_host: API_HOST,
      ui_host: POSTHOG_UI_HOST,
      // Newest dated value at install time. Anything from '2025-05-24' on turns
      // on capture_pageview: 'history_change'; without it App Router soft
      // navigations fire no $pageview at all.
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: true,
      capture_exceptions: true,
      capture_performance: true,
      // before_send does not see replay data, so a direct load of an admin URL
      // has to start with recording off rather than be filtered afterwards.
      disable_session_recording: isAdminAnalyticsUrl(window.location.href),
      before_send: dropAdminAnalytics,
    });
  } catch (error) {
    console.error("[analytics] PostHog failed to initialize:", error);
  }
}

/**
 * The only way a call site sends an event. Names come from `events.ts`, never a
 * string literal, and an un-configured PostHog is a silent no-op rather than a
 * throw inside a click handler.
 */
export function captureEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  if (!isAnalyticsEnabled()) return;

  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error(`[analytics] failed to capture ${event}:`, error);
  }
}

/**
 * Called at navigation start, so entering `/admin` stops recording before the
 * admin DOM is ever snapshotted. Resuming is deliberately not done here:
 * starting early would snapshot the page being navigated away from.
 */
export function handleRouterTransitionStart(url: string): void {
  if (!isAnalyticsEnabled()) return;
  if (isAdminAnalyticsUrl(url)) posthog.stopSessionRecording();
}

export function stopSessionRecording(): void {
  if (!isAnalyticsEnabled()) return;
  posthog.stopSessionRecording();
}

export function startSessionRecording(): void {
  if (!isAnalyticsEnabled()) return;
  posthog.startSessionRecording();
}
