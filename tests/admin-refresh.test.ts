import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_REFRESH_INTERVAL_MS,
  ADMIN_REFRESH_MEMORY_LIMIT,
  formatRefreshedAt,
  getAdminRouteKey,
  rememberRefreshedAt,
  scheduleAdminRefresh,
} from "@/app/(admin)/admin-refresh";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/listings",
  useSearchParams: () => new URLSearchParams("status=active"),
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminRefreshControl } from "@/app/(admin)/AdminRefreshControl";
import { AdminRefreshProvider } from "@/app/(admin)/AdminRefreshProvider";

const NOW = Date.UTC(2026, 7, 27, 15, 42, 0);

type Listener = () => void;

const documentStub = {
  visibilityState: "visible" as "visible" | "hidden",
  listeners: new Map<string, Set<Listener>>(),
  addEventListener(type: string, listener: Listener): void {
    const set = documentStub.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    documentStub.listeners.set(type, set);
  },
  removeEventListener(type: string, listener: Listener): void {
    documentStub.listeners.get(type)?.delete(listener);
  },
};

/** ICU 72+ separates the meridiem with U+202F, so assertions compare on plain spaces. */
function normalizeSpaces(value: string): string {
  return value.replace(/\u202f/g, " ");
}

function visibilityListenerCount(): number {
  return documentStub.listeners.get("visibilitychange")?.size ?? 0;
}

function emitVisibilityChange(state: "visible" | "hidden"): void {
  documentStub.visibilityState = state;
  for (const listener of documentStub.listeners.get("visibilitychange") ?? []) {
    listener();
  }
}

beforeEach(() => {
  documentStub.visibilityState = "visible";
  documentStub.listeners = new Map<string, Set<Listener>>();
  vi.stubGlobal("document", documentStub);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ADMIN_REFRESH_INTERVAL_MS", () => {
  it("is one hour", () => {
    expect(ADMIN_REFRESH_INTERVAL_MS).toBe(60 * 60 * 1000);
  });
});

describe("getAdminRouteKey", () => {
  it("returns the bare pathname when there is no query", () => {
    expect(getAdminRouteKey("/admin/listings", "")).toBe("/admin/listings");
  });

  it("appends the query string", () => {
    expect(getAdminRouteKey("/admin/logs", "status=all&page=2")).toBe(
      "/admin/logs?status=all&page=2",
    );
  });

  it("accepts a raw location.search with its leading question mark", () => {
    expect(getAdminRouteKey("/admin/logs", "?status=all")).toBe(
      "/admin/logs?status=all",
    );
  });

  it("normalizes equivalent encodings so the same URL compares equal", () => {
    expect(getAdminRouteKey("/admin/users", "?q=ada%20lovelace")).toBe(
      getAdminRouteKey("/admin/users", "q=ada+lovelace"),
    );
  });
});

describe("rememberRefreshedAt", () => {
  it("records a route's time", () => {
    const memory = new Map<string, number>();

    rememberRefreshedAt(memory, "/admin", NOW);

    expect(memory.get("/admin")).toBe(NOW);
  });

  it("overwrites a route it already knows", () => {
    const memory = new Map<string, number>([["/admin", NOW]]);

    rememberRefreshedAt(memory, "/admin", NOW + 1000);

    expect(memory.get("/admin")).toBe(NOW + 1000);
    expect(memory.size).toBe(1);
  });

  it("evicts the least recently recorded route past the limit", () => {
    const memory = new Map<string, number>();
    for (let i = 0; i < ADMIN_REFRESH_MEMORY_LIMIT; i += 1) {
      rememberRefreshedAt(memory, `/admin/${i}`, NOW + i);
    }

    rememberRefreshedAt(memory, "/admin/new", NOW);

    expect(memory.size).toBe(ADMIN_REFRESH_MEMORY_LIMIT);
    expect(memory.has("/admin/0")).toBe(false);
    expect(memory.has("/admin/new")).toBe(true);
  });

  it("keeps a route alive by re-recording it", () => {
    const memory = new Map<string, number>();
    for (let i = 0; i < ADMIN_REFRESH_MEMORY_LIMIT; i += 1) {
      rememberRefreshedAt(memory, `/admin/${i}`, NOW + i);
    }

    rememberRefreshedAt(memory, "/admin/0", NOW + 5000);
    rememberRefreshedAt(memory, "/admin/new", NOW);

    expect(memory.has("/admin/0")).toBe(true);
    expect(memory.has("/admin/1")).toBe(false);
  });
});

describe("formatRefreshedAt", () => {
  it("labels the local wall-clock time", () => {
    const { label } = formatRefreshedAt(NOW);

    expect(normalizeSpaces(label)).toBe("Last refreshed at 3:42 PM");
  });

  it("carries the full local date and time as the title", () => {
    const { title } = formatRefreshedAt(NOW);

    expect(normalizeSpaces(title)).toBe("August 27, 2026 at 3:42 PM");
  });

  it("carries a machine-readable dateTime", () => {
    expect(formatRefreshedAt(NOW).dateTime).toBe("2026-08-27T15:42:00.000Z");
  });
});

describe("scheduleAdminRefresh", () => {
  it("refreshes a visible page once the interval elapses", () => {
    const onDue = vi.fn();
    scheduleAdminRefresh(NOW, onDue);

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - 1);
    expect(onDue).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDue).toHaveBeenCalledOnce();
  });

  it("does not refresh a hidden page at the deadline", () => {
    const onDue = vi.fn();
    scheduleAdminRefresh(NOW, onDue);

    documentStub.visibilityState = "hidden";
    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS);

    expect(onDue).not.toHaveBeenCalled();
  });

  it("refreshes exactly once when an overdue hidden page becomes visible", () => {
    const onDue = vi.fn();
    scheduleAdminRefresh(NOW, onDue);

    documentStub.visibilityState = "hidden";
    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS + 60_000);
    expect(onDue).not.toHaveBeenCalled();

    emitVisibilityChange("visible");
    expect(onDue).toHaveBeenCalledOnce();

    emitVisibilityChange("hidden");
    emitVisibilityChange("visible");
    expect(onDue).toHaveBeenCalledOnce();
  });

  it("keeps the remaining delay when the page returns before the deadline", () => {
    const onDue = vi.fn();
    scheduleAdminRefresh(NOW, onDue);

    documentStub.visibilityState = "hidden";
    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - 10_000);
    emitVisibilityChange("visible");
    expect(onDue).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(onDue).toHaveBeenCalledOnce();
  });

  it("fires immediately for a deadline that is already past", () => {
    const onDue = vi.fn();
    scheduleAdminRefresh(NOW - ADMIN_REFRESH_INTERVAL_MS * 2, onDue);

    vi.advanceTimersByTime(0);
    expect(onDue).toHaveBeenCalledOnce();
  });

  it("clears the timeout and the visibility listener on teardown", () => {
    const onDue = vi.fn();
    const cleanup = scheduleAdminRefresh(NOW, onDue);

    expect(visibilityListenerCount()).toBe(1);

    cleanup();

    expect(visibilityListenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS * 2);
    expect(onDue).not.toHaveBeenCalled();
  });
});

describe("AdminRefreshControl markup", () => {
  function renderControl(): string {
    return renderToStaticMarkup(
      React.createElement(
        AdminRefreshProvider,
        null,
        React.createElement(AdminRefreshControl, null),
      ),
    );
  }

  it("labels the button and leaves it idle", () => {
    const html = renderControl();

    expect(html).toContain('aria-label="Refresh admin data"');
    expect(html).toContain('title="Refresh admin data"');
    expect(html).toContain("size-9");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-busy="false"');
    expect(html).not.toContain("animate-spin");
  });

  it("renders no timestamp before mount, and reserves its width", () => {
    const html = renderControl();

    expect(html).not.toContain("<time");
    expect(html).not.toContain("Last refreshed");
    expect(html).toContain("min-w-39");
  });

  it("stays in the header flow at every breakpoint", () => {
    const html = renderControl();

    expect(html).toContain("justify-end");
    expect(html).not.toContain("absolute");
    expect(html).not.toContain("mb-4");
  });
});
