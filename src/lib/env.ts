const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "FORMSPREE_CONTACT_ENDPOINT",
  "CLEANUP_SECRET",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_CLIENT_EMAIL",
  "GOOGLE_CLOUD_PRIVATE_KEY",
] as const;

export type RequiredServerEnvVar = (typeof REQUIRED_SERVER_ENV)[number];

/**
 * Required variables that must also parse as an absolute http(s) URL. Presence
 * alone is not enough for these: a scheme-less `NEXT_PUBLIC_SITE_URL` is
 * non-blank, so it passes a presence check, and `resolveSiteUrl` then falls
 * back to the production origin. A staging deploy would build production
 * Stripe return URLs and never say so.
 */
const URL_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
] as const satisfies readonly RequiredServerEnvVar[];

type EnvRecord = Record<string, string | undefined>;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function missingServerEnv(
  env: EnvRecord = process.env,
): RequiredServerEnvVar[] {
  return REQUIRED_SERVER_ENV.filter((name) => (env[name] ?? "").trim() === "");
}

/**
 * Set but unusable. A blank value is reported by `missingServerEnv` instead, so
 * one variable never appears in both lists.
 */
export function invalidServerEnv(
  env: EnvRecord = process.env,
): RequiredServerEnvVar[] {
  return URL_SERVER_ENV.filter((name) => {
    const value = (env[name] ?? "").trim();
    return value !== "" && !isAbsoluteHttpUrl(value);
  });
}

/**
 * Throws so a deploy fails outright rather than serving an app whose bad config
 * surfaces only on the one request that needs it. Variables with a defined
 * fallback (LISTING_FEE_CENTS, PAYMENTS_SUSPENDED) stay optional.
 */
export function assertServerEnv(env: EnvRecord = process.env): void {
  const missing = missingServerEnv(env);
  const invalid = invalidServerEnv(env);
  if (missing.length === 0 && invalid.length === 0) return;

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(
      `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  }
  if (invalid.length > 0) {
    problems.push(
      `Environment variable${invalid.length > 1 ? "s" : ""} must be an absolute http(s) URL: ${invalid.join(", ")}`,
    );
  }

  throw new Error(problems.join(". "));
}
