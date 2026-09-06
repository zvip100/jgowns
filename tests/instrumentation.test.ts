import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { register } from "@/instrumentation";

const COMPLETE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  NEXT_RUNTIME: "nodejs",
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

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...COMPLETE_ENV };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("register", () => {
  it("returns silently when the environment is complete", () => {
    expect(() => register()).not.toThrow();
  });

  it("throws so the deploy fails when a required variable is missing", () => {
    delete process.env.CLEANUP_SECRET;
    expect(() => register()).toThrow(
      "Missing required environment variable: CLEANUP_SECRET",
    );
  });

  /**
   * The boot guard's whole point: a scheme-less site URL is non-blank, so a
   * presence check passes it and `resolveSiteUrl` falls back to the production
   * origin, which would let a staging deploy mint production Stripe return URLs.
   */
  it("throws on a set but unusable URL instead of falling back to production", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "jgowns-staging.up.railway.app";
    expect(() => register()).toThrow(
      "Environment variable must be an absolute http(s) URL: NEXT_PUBLIC_SITE_URL",
    );
  });

  it("stays silent off the nodejs runtime, where env vars are not inlined", () => {
    process.env.NEXT_RUNTIME = "edge";
    delete process.env.CLEANUP_SECRET;
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(() => register()).not.toThrow();
  });

  it("stays silent when the runtime is unset", () => {
    delete process.env.NEXT_RUNTIME;
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => register()).not.toThrow();
  });
});
