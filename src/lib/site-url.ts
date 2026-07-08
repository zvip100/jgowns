const FALLBACK_SITE_URL = "https://jgowns.com";

function resolveSiteUrl(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

/** Canonical origin (no trailing slash), e.g. `https://jgowns.com`. */
export const SITE_URL = resolveSiteUrl();
