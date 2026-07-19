const FALLBACK_SITE_URL = "https://jgowns.com";

function resolveSiteUrl(): string {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
    return url.origin;
  } catch (error) {
    console.error("Invalid NEXT_PUBLIC_SITE_URL, falling back to default:", error);
    return FALLBACK_SITE_URL;
  }
}

/** Canonical origin (no trailing slash), e.g. `https://jgowns.com`. */
export const SITE_URL = resolveSiteUrl();

/**
 * Placeholder support address — swap for the real mailbox in one line.
 * Referenced by the footer, contact page, and legal documents.
 */
export const CONTACT_EMAIL = "hello@jgowns.com";
