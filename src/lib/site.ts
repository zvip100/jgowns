const FALLBACK_SITE_URL = "https://jgowns.com";
const FALLBACK_POSTHOG_PROJECT_URL = "https://us.posthog.com";

/** Parse an absolute URL, or `null` when it is malformed, relative, or off-protocol. */
function parseUrl(value: string, protocols: readonly string[]): URL | null {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL;
  const url = parseUrl(configured, ["http:", "https:"]);
  if (url) return url.origin;

  console.error("Invalid NEXT_PUBLIC_SITE_URL, falling back to default.");
  return FALLBACK_SITE_URL;
}

/**
 * Unlike SITE_URL this keeps the configured path, because the value is a
 * project deep link (`/project/538569`), not just an origin.
 */
function resolvePostHogProjectUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_URL;
  if (!configured) return new URL(FALLBACK_POSTHOG_PROJECT_URL);

  const url = parseUrl(configured, ["https:"]);
  if (url) return url;

  console.error(
    "Invalid NEXT_PUBLIC_POSTHOG_PROJECT_URL, falling back to default.",
  );
  return new URL(FALLBACK_POSTHOG_PROJECT_URL);
}

/** Canonical origin (no trailing slash), e.g. `https://jgowns.com`. */
export const SITE_URL = resolveSiteUrl();

/**
 * Placeholder support address — swap for the real mailbox in one line.
 * Referenced by the footer, contact page, and legal documents.
 */
export const CONTACT_EMAIL = "info@jgowns.com";

const posthogProjectUrl = resolvePostHogProjectUrl();

/**
 * Validated PostHog project link target for /admin/metrics. Optional like the
 * rest of the analytics config, so an unset or unusable value falls back to the
 * PostHog app rather than rendering an href the browser resolves relatively.
 */
export const POSTHOG_PROJECT_URL = posthogProjectUrl.href;

/**
 * The SDK's `ui_host`, so in-app links resolve past the ingestion proxy. It
 * lives beside SITE_URL rather than inside the analytics modules (those import
 * an SDK; this does not).
 */
export const POSTHOG_UI_HOST = posthogProjectUrl.origin;
