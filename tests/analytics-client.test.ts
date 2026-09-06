import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CaptureResult } from "posthog-js";

const posthogMock = {
  __loaded: false,
  capture: vi.fn(),
  init: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
};

vi.mock("posthog-js", () => ({ default: posthogMock }));

const ORIGINAL_ENV = { ...process.env };

async function importFresh(env: Record<string, string | undefined> = {}) {
  process.env = { ...ORIGINAL_ENV, ...env };
  vi.resetModules();
  return import("@/lib/analytics/client");
}

function stubWindow(href: string): void {
  (globalThis as { window?: unknown }).window = { location: { href } };
}

function captureResult(event: string, currentUrl?: string): CaptureResult {
  return {
    uuid: "01931000-0000-7000-8000-000000000000",
    event,
    properties: currentUrl === undefined ? {} : { $current_url: currentUrl },
  };
}

beforeEach(() => {
  posthogMock.__loaded = false;
  posthogMock.capture.mockClear();
  posthogMock.init.mockClear();
  posthogMock.startSessionRecording.mockClear();
  posthogMock.stopSessionRecording.mockClear();
  stubWindow("http://localhost:3000/browse");
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe("isAdminAnalyticsUrl", () => {
  it("matches admin paths, absolute and relative", async () => {
    const { isAdminAnalyticsUrl } = await importFresh();
    expect(isAdminAnalyticsUrl("/admin")).toBe(true);
    expect(isAdminAnalyticsUrl("/admin/listings?q=lace")).toBe(true);
    expect(isAdminAnalyticsUrl("https://jgowns.com/admin/users/1")).toBe(true);
  });

  it("leaves non-admin paths alone", async () => {
    const { isAdminAnalyticsUrl } = await importFresh();
    expect(isAdminAnalyticsUrl("/browse")).toBe(false);
    expect(isAdminAnalyticsUrl("https://jgowns.com/dashboard")).toBe(false);
    // A future sibling route must not be swallowed by a bare startsWith.
    expect(isAdminAnalyticsUrl("/administration")).toBe(false);
  });

  it("returns false for anything that is not a usable string", async () => {
    const { isAdminAnalyticsUrl } = await importFresh();
    expect(isAdminAnalyticsUrl(undefined)).toBe(false);
    expect(isAdminAnalyticsUrl(null)).toBe(false);
    expect(isAdminAnalyticsUrl("")).toBe(false);
    expect(isAdminAnalyticsUrl(42)).toBe(false);
  });
});

describe("dropAdminAnalytics", () => {
  it("drops an analytics event captured on an admin page", async () => {
    const { dropAdminAnalytics } = await importFresh();
    expect(
      dropAdminAnalytics(
        captureResult("$pageview", "http://localhost:3000/admin/listings"),
      ),
    ).toBeNull();
  });

  it("keeps an exception captured on an admin page", async () => {
    const { dropAdminAnalytics } = await importFresh();
    const cr = captureResult("$exception", "http://localhost:3000/admin");
    expect(dropAdminAnalytics(cr)).toBe(cr);
  });

  it("keeps events from every other page", async () => {
    const { dropAdminAnalytics } = await importFresh();
    const cr = captureResult("listing_viewed", "http://localhost:3000/browse/1");
    expect(dropAdminAnalytics(cr)).toBe(cr);
  });

  it("keeps an event whose url cannot be judged", async () => {
    const { dropAdminAnalytics } = await importFresh();
    const cr = captureResult("$autocapture");
    expect(dropAdminAnalytics(cr)).toBe(cr);
  });

  it("passes a null capture result straight through", async () => {
    const { dropAdminAnalytics } = await importFresh();
    expect(dropAdminAnalytics(null)).toBeNull();
  });
});

describe("initAnalytics", () => {
  const CONFIGURED = {
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://ph.jgowns.com",
    NEXT_PUBLIC_POSTHOG_PROJECT_URL: "https://us.posthog.com/project/123",
  };

  it("initializes with the spec's configuration", async () => {
    const { initAnalytics, dropAdminAnalytics } = await importFresh(CONFIGURED);
    initAnalytics();

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    const [token, config] = posthogMock.init.mock.calls[0];
    expect(token).toBe("phc_test");
    expect(config).toMatchObject({
      api_host: "https://ph.jgowns.com",
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: true,
      capture_exceptions: true,
      capture_performance: true,
      disable_session_recording: false,
      before_send: dropAdminAnalytics,
    });
  });

  it("starts with session recording off when the first page is an admin page", async () => {
    stubWindow("http://localhost:3000/admin/listings");
    const { initAnalytics } = await importFresh(CONFIGURED);
    initAnalytics();
    expect(posthogMock.init.mock.calls[0][1].disable_session_recording).toBe(true);
  });

  it("falls back to the PostHog app host when the project url is unusable", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics } = await importFresh({
      ...CONFIGURED,
      NEXT_PUBLIC_POSTHOG_PROJECT_URL: "not-a-url",
    });
    initAnalytics();
    expect(posthogMock.init.mock.calls[0][1].ui_host).toBe("https://us.posthog.com");
    expect(errors).toHaveBeenCalled();
  });

  it("is a no-op that names the missing variable in development", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics } = await importFresh({
      NODE_ENV: "development",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    initAnalytics();

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(2);
    expect(errors.mock.calls[0][0]).toContain("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
    expect(errors.mock.calls[1][0]).toContain("NEXT_PUBLIC_POSTHOG_HOST");
  });

  it("stays silent in production when nothing is configured", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics } = await importFresh({
      NODE_ENV: "production",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    initAnalytics();

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("does not initialize with only half the configuration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics } = await importFresh({
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("does not initialize twice", async () => {
    const { initAnalytics } = await importFresh(CONFIGURED);
    posthogMock.__loaded = true;
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("does nothing on the server", async () => {
    delete (globalThis as { window?: unknown }).window;
    const { initAnalytics } = await importFresh(CONFIGURED);
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });
});

describe("isAnalyticsEnabled", () => {
  it("tracks whether the SDK loaded", async () => {
    const { isAnalyticsEnabled } = await importFresh();
    expect(isAnalyticsEnabled()).toBe(false);
    posthogMock.__loaded = true;
    expect(isAnalyticsEnabled()).toBe(true);
  });
});

describe("session recording controls", () => {
  it("stops recording when a navigation heads into admin", async () => {
    const { handleRouterTransitionStart } = await importFresh();
    posthogMock.__loaded = true;
    handleRouterTransitionStart("/admin/listings");
    expect(posthogMock.stopSessionRecording).toHaveBeenCalledTimes(1);
  });

  it("never starts recording at navigation start", async () => {
    const { handleRouterTransitionStart } = await importFresh();
    posthogMock.__loaded = true;
    handleRouterTransitionStart("/browse");
    expect(posthogMock.stopSessionRecording).not.toHaveBeenCalled();
    expect(posthogMock.startSessionRecording).not.toHaveBeenCalled();
  });

  it("stops and starts on demand once the SDK is loaded", async () => {
    const { startSessionRecording, stopSessionRecording } = await importFresh();
    posthogMock.__loaded = true;
    stopSessionRecording();
    startSessionRecording();
    expect(posthogMock.stopSessionRecording).toHaveBeenCalledTimes(1);
    expect(posthogMock.startSessionRecording).toHaveBeenCalledTimes(1);
  });

  it("is inert while the SDK is not loaded", async () => {
    const { handleRouterTransitionStart, startSessionRecording, stopSessionRecording } =
      await importFresh();
    handleRouterTransitionStart("/admin");
    stopSessionRecording();
    startSessionRecording();
    expect(posthogMock.stopSessionRecording).not.toHaveBeenCalled();
    expect(posthogMock.startSessionRecording).not.toHaveBeenCalled();
  });
});

describe("captureEvent", () => {
  it("sends the event and its properties once the SDK is loaded", async () => {
    const { captureEvent } = await importFresh();
    posthogMock.__loaded = true;

    captureEvent("listing_viewed", { listing_id: "l1", price: 400 });

    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
    expect(posthogMock.capture).toHaveBeenCalledWith("listing_viewed", {
      listing_id: "l1",
      price: 400,
    });
  });

  it("sends an event with no properties", async () => {
    const { captureEvent } = await importFresh();
    posthogMock.__loaded = true;

    captureEvent("listing_draft_started");

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "listing_draft_started",
      undefined,
    );
  });

  // An un-configured PostHog must never break the click that triggered it.
  it("is a silent no-op while the SDK is not loaded", async () => {
    const { captureEvent } = await importFresh();
    captureEvent("contact_call_clicked", { listing_id: "l1" });
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it("swallows a capture failure instead of throwing into the caller", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureEvent } = await importFresh();
    posthogMock.__loaded = true;
    posthogMock.capture.mockImplementationOnce(() => {
      throw new Error("transport down");
    });

    expect(() => captureEvent("contact_copied", { listing_id: "l1" })).not.toThrow();
    expect(errors).toHaveBeenCalled();
  });
});
