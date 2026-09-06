import { describe, expect, it } from "vitest";

import { assertServerEnv, invalidServerEnv, missingServerEnv } from "@/lib/env";

const COMPLETE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  NEXT_PUBLIC_SITE_URL: "https://jgowns.com",
  STRIPE_SECRET_KEY: "rk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  FORMSPREE_CONTACT_ENDPOINT: "https://formspree.io/f/x",
  CLEANUP_SECRET: "cleanup",
  GOOGLE_CLOUD_PROJECT_ID: "gcp",
  GOOGLE_CLOUD_CLIENT_EMAIL: "svc@gcp.iam.gserviceaccount.com",
  GOOGLE_CLOUD_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
};

describe("missingServerEnv", () => {
  it("returns nothing when every required variable is set", () => {
    expect(missingServerEnv({ ...COMPLETE_ENV })).toEqual([]);
  });

  it("ignores optional variables that have a defined fallback", () => {
    // LISTING_FEE_CENTS, PAYMENTS_SUSPENDED and the NEXT_PUBLIC_POSTHOG_* trio
    // are all absent from COMPLETE_ENV and must never be reported.
    expect(missingServerEnv({ ...COMPLETE_ENV })).toEqual([]);
    expect(() => assertServerEnv({ ...COMPLETE_ENV })).not.toThrow();
  });

  it("reports an unset variable", () => {
    const env: Record<string, string | undefined> = { ...COMPLETE_ENV };
    delete env.CLEANUP_SECRET;
    expect(missingServerEnv(env)).toEqual(["CLEANUP_SECRET"]);
  });

  it("treats an empty or whitespace-only value as missing", () => {
    expect(
      missingServerEnv({ ...COMPLETE_ENV, STRIPE_SECRET_KEY: "" }),
    ).toEqual(["STRIPE_SECRET_KEY"]);
    expect(
      missingServerEnv({ ...COMPLETE_ENV, STRIPE_WEBHOOK_SECRET: "   " }),
    ).toEqual(["STRIPE_WEBHOOK_SECRET"]);
  });

  it("reports every missing variable in declaration order", () => {
    const env: Record<string, string | undefined> = { ...COMPLETE_ENV };
    delete env.GOOGLE_CLOUD_PRIVATE_KEY;
    delete env.SUPABASE_SECRET_KEY;
    expect(missingServerEnv(env)).toEqual([
      "SUPABASE_SECRET_KEY",
      "GOOGLE_CLOUD_PRIVATE_KEY",
    ]);
  });

  it("reads process.env by default", () => {
    expect(Array.isArray(missingServerEnv())).toBe(true);
  });
});

describe("assertServerEnv", () => {
  it("returns silently when nothing is missing", () => {
    expect(() => assertServerEnv({ ...COMPLETE_ENV })).not.toThrow();
  });

  it("throws naming the single missing variable", () => {
    const env: Record<string, string | undefined> = { ...COMPLETE_ENV };
    delete env.FORMSPREE_CONTACT_ENDPOINT;
    expect(() => assertServerEnv(env)).toThrow(
      "Missing required environment variable: FORMSPREE_CONTACT_ENDPOINT",
    );
  });

  it("throws naming every missing variable", () => {
    const env: Record<string, string | undefined> = { ...COMPLETE_ENV };
    delete env.STRIPE_SECRET_KEY;
    delete env.CLEANUP_SECRET;
    expect(() => assertServerEnv(env)).toThrow(
      "Missing required environment variables: STRIPE_SECRET_KEY, CLEANUP_SECRET",
    );
  });

  it("throws on a scheme-less site URL rather than falling back to production", () => {
    const env = { ...COMPLETE_ENV, NEXT_PUBLIC_SITE_URL: "jgowns-staging.up.railway.app" };
    expect(() => assertServerEnv(env)).toThrow(
      "Environment variable must be an absolute http(s) URL: NEXT_PUBLIC_SITE_URL",
    );
  });

  it("throws naming every unusable URL variable", () => {
    const env = {
      ...COMPLETE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "not a url",
      NEXT_PUBLIC_SITE_URL: "ftp://jgowns.com",
    };
    expect(() => assertServerEnv(env)).toThrow(
      "Environment variables must be an absolute http(s) URL: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SITE_URL",
    );
  });

  it("reports a blank URL variable as missing only, never as invalid", () => {
    const env = { ...COMPLETE_ENV, NEXT_PUBLIC_SITE_URL: "   " };
    expect(invalidServerEnv(env)).toEqual([]);
    expect(missingServerEnv(env)).toEqual(["NEXT_PUBLIC_SITE_URL"]);
    expect(() => assertServerEnv(env)).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SITE_URL",
    );
  });

  it("reports both problems at once", () => {
    const env: Record<string, string | undefined> = {
      ...COMPLETE_ENV,
      NEXT_PUBLIC_SITE_URL: "jgowns.com",
    };
    delete env.CLEANUP_SECRET;
    expect(() => assertServerEnv(env)).toThrow(
      "Missing required environment variable: CLEANUP_SECRET. Environment variable must be an absolute http(s) URL: NEXT_PUBLIC_SITE_URL",
    );
  });
});

describe("invalidServerEnv", () => {
  it("accepts a complete, well-formed environment", () => {
    expect(invalidServerEnv({ ...COMPLETE_ENV })).toEqual([]);
  });

  it("accepts http for local development", () => {
    expect(
      invalidServerEnv({ ...COMPLETE_ENV, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
    ).toEqual([]);
  });

  it("rejects a non-http protocol", () => {
    expect(
      invalidServerEnv({ ...COMPLETE_ENV, NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" }),
    ).toEqual(["NEXT_PUBLIC_SITE_URL"]);
  });

  it("ignores required variables that are not URLs", () => {
    expect(
      invalidServerEnv({ ...COMPLETE_ENV, CLEANUP_SECRET: "not a url either" }),
    ).toEqual([]);
  });

  it("reads process.env by default", () => {
    expect(Array.isArray(invalidServerEnv())).toBe(true);
  });
});
