import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function importFresh(env: Record<string, string | undefined> = {}) {
  process.env = { ...ORIGINAL_ENV, ...env };
  vi.resetModules();
  return import("@/lib/site");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("SITE_URL", () => {
  it("reduces the configured value to its origin", async () => {
    const { SITE_URL } = await importFresh({
      NEXT_PUBLIC_SITE_URL: "https://jgowns.com/browse?page=2",
    });
    expect(SITE_URL).toBe("https://jgowns.com");
  });

  it("keeps http so a local dev origin still works", async () => {
    const { SITE_URL } = await importFresh({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
    expect(SITE_URL).toBe("http://localhost:3000");
  });

  it("falls back when the value is malformed, relative, or off-protocol", async () => {
    for (const value of ["not-a-url", "/browse", "javascript:alert(1)"]) {
      const { SITE_URL } = await importFresh({ NEXT_PUBLIC_SITE_URL: value });
      expect(SITE_URL).toBe("https://jgowns.com");
    }
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it("falls back when the value is unset", async () => {
    const { SITE_URL } = await importFresh({ NEXT_PUBLIC_SITE_URL: undefined });
    expect(SITE_URL).toBe("https://jgowns.com");
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("CONTACT_EMAIL", () => {
  it("is the support mailbox", async () => {
    const { CONTACT_EMAIL } = await importFresh();
    expect(CONTACT_EMAIL).toBe("info@jgowns.com");
  });
});

describe("POSTHOG_PROJECT_URL", () => {
  it("keeps the configured project path so the admin link deep-links", async () => {
    const { POSTHOG_PROJECT_URL, POSTHOG_UI_HOST } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_URL: "https://us.posthog.com/project/538569",
    });
    expect(POSTHOG_PROJECT_URL).toBe("https://us.posthog.com/project/538569");
    expect(POSTHOG_UI_HOST).toBe("https://us.posthog.com");
  });

  it("falls back when the value is malformed or relative", async () => {
    for (const value of ["not-a-url", "us.posthog.com/project/1", "/project/1"]) {
      const { POSTHOG_PROJECT_URL, POSTHOG_UI_HOST } = await importFresh({
        NEXT_PUBLIC_POSTHOG_PROJECT_URL: value,
      });
      expect(POSTHOG_PROJECT_URL).toBe("https://us.posthog.com/");
      expect(POSTHOG_UI_HOST).toBe("https://us.posthog.com");
    }
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it("rejects a non-https absolute url", async () => {
    for (const value of ["http://us.posthog.com/project/1", "javascript:alert(1)"]) {
      const { POSTHOG_PROJECT_URL } = await importFresh({
        NEXT_PUBLIC_POSTHOG_PROJECT_URL: value,
      });
      expect(POSTHOG_PROJECT_URL).toBe("https://us.posthog.com/");
    }
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("falls back quietly when the value is unset", async () => {
    const { POSTHOG_PROJECT_URL, POSTHOG_UI_HOST } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_URL: undefined,
    });
    expect(POSTHOG_PROJECT_URL).toBe("https://us.posthog.com/");
    expect(POSTHOG_UI_HOST).toBe("https://us.posthog.com");
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("appEnvironmentFor", () => {
  it("reads local and private-network hosts as development", async () => {
    const { appEnvironmentFor } = await importFresh();
    for (const url of [
      "http://localhost:3000",
      "http://jgowns.localhost:3000",
      "http://127.0.0.1:3000",
      "http://0.0.0.0:3000",
      "http://[::1]:3000",
      "http://10.0.0.5:3000",
      "http://192.168.1.4:3000",
      "http://172.16.0.2:3000",
      "http://172.31.255.1:3000",
      "http://localhost.:3000",
      "http://jgowns.localhost.:3000",
    ]) {
      expect(appEnvironmentFor(url)).toBe("development");
    }
  });

  it("reads every other host as production, whatever its port or scheme", async () => {
    const { appEnvironmentFor } = await importFresh();
    for (const url of [
      "https://jgowns.com",
      "https://www.jgowns.com",
      "https://jgowns.up.railway.app",
      "http://172.32.0.1",
      "http://11.0.0.1",
      "https://localhost.example.com",
    ]) {
      expect(appEnvironmentFor(url)).toBe("production");
    }
  });
});

describe("APP_ENVIRONMENT", () => {
  it("follows NEXT_PUBLIC_SITE_URL, not NODE_ENV", async () => {
    const local = await importFresh({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
    expect(local.APP_ENVIRONMENT).toBe("development");

    const live = await importFresh({
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: "https://jgowns.com",
    });
    expect(live.APP_ENVIRONMENT).toBe("production");
  });
});
