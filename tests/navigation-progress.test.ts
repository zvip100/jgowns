import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement, ReactNode } from "react";

type Store = typeof import("@/lib/navigation-progress");
type Props = Record<string, unknown>;

const { effects, mockHandleRouterTransitionStart, mockInitAnalytics, routerState } =
  vi.hoisted(() => ({
    effects: [] as (() => void | (() => void))[],
    mockHandleRouterTransitionStart: vi.fn(),
    mockInitAnalytics: vi.fn(),
    routerState: { pathname: "/", search: "" },
  }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: (run: () => void | (() => void)): void => {
      effects.push(run);
    },
    useSyncExternalStore: <Snapshot>(
      _subscribe: unknown,
      getSnapshot: () => Snapshot,
    ): Snapshot => getSnapshot(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => routerState.pathname,
  useSearchParams: () => new URLSearchParams(routerState.search),
}));

vi.mock("@/lib/analytics/client", () => ({
  handleRouterTransitionStart: mockHandleRouterTransitionStart,
  initAnalytics: mockInitAnalytics,
}));

async function loadStore(): Promise<Store> {
  return import("@/lib/navigation-progress");
}

/** Every element in a tree, without calling components that sit behind a Suspense boundary. */
function collect(React: typeof import("react"), node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(React, child));
  if (!React.isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  return [element, ...collect(React, element.props.children as ReactNode)];
}

async function renderBar(): Promise<{
  bar: ReactElement<Props>;
  segment: ReactElement<Props>;
  runTracker: () => void;
}> {
  const React = await import("react");
  const { default: NavigationProgress } = await import(
    "@/components/NavigationProgress"
  );
  const elements = collect(React, (NavigationProgress as () => ReactNode)());
  const bar = elements.find(
    (element) => element.props.className === "navigation-progress",
  );
  const tracker = elements.find((element) => typeof element.type === "function");
  if (!bar || !tracker) throw new Error("NavigationProgress did not render");

  return {
    bar,
    segment: bar.props.children as ReactElement<Props>,
    runTracker: () => {
      effects.length = 0;
      (tracker.type as () => null)();
      effects.forEach((run) => run());
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("window", { location: { href: "http://localhost:3000/" } });
  effects.length = 0;
  routerState.pathname = "/";
  routerState.search = "";
  mockHandleRouterTransitionStart.mockClear();
  mockInitAnalytics.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getNavigationProgress", () => {
  it("starts idle", async () => {
    const store = await loadStore();

    expect(store.getNavigationProgress()).toEqual({ id: 0, isPending: false });
  });

  it("returns the same snapshot until something changes", async () => {
    const store = await loadStore();

    expect(store.getNavigationProgress()).toBe(store.getNavigationProgress());
    store.startNavigationProgress("/browse");
    expect(store.getNavigationProgress()).toBe(store.getNavigationProgress());
  });
});

describe("startNavigationProgress", () => {
  it("marks a navigation pending under a new id", async () => {
    const store = await loadStore();

    store.startNavigationProgress("/browse");

    expect(store.getNavigationProgress()).toEqual({ id: 1, isPending: true });
  });

  it("keeps the same bar when a second navigation overtakes a pending one", async () => {
    const store = await loadStore();
    const listener = vi.fn();
    store.startNavigationProgress("/browse");
    const pending = store.getNavigationProgress();
    store.subscribeNavigationProgress(listener);

    store.startNavigationProgress("/browse?category=bridal");

    expect(store.getNavigationProgress()).toBe(pending);
    expect(listener).not.toHaveBeenCalled();
  });

  it("uses a new id for each bar shown", async () => {
    const store = await loadStore();

    store.startNavigationProgress("/browse");
    store.commitNavigationProgress("/browse", "");
    store.startNavigationProgress("/dashboard");

    expect(store.getNavigationProgress()).toEqual({ id: 2, isPending: true });
  });

  it("does not start for the URL already on screen", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse", "category=bridal");

    store.startNavigationProgress("/browse?category=bridal");

    expect(store.getNavigationProgress()).toEqual({ id: 0, isPending: false });
  });

  it("treats an absolute URL and a hash on the current page as the same URL", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse", "");

    store.startNavigationProgress("http://localhost:3000/browse");
    store.startNavigationProgress("/browse#main-content");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("resolves a fragment-only target against the current page", async () => {
    const store = await loadStore();
    window.location.href = "http://localhost:3000/browse?category=bridal";
    store.commitNavigationProgress("/browse", "category=bridal");

    store.startNavigationProgress("#main-content");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("resolves a query-only target against the current page", async () => {
    const store = await loadStore();
    window.location.href = "http://localhost:3000/browse?category=bridal";
    store.commitNavigationProgress("/browse", "category=bridal");

    store.startNavigationProgress("?category=bridal");
    expect(store.getNavigationProgress().isPending).toBe(false);

    store.startNavigationProgress("?category=girls");
    expect(store.getNavigationProgress().isPending).toBe(true);
  });

  it("matches a query that is encoded differently", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse", "q=lace+gown");

    store.startNavigationProgress("/browse?q=lace%20gown");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("ends a pending bar when the newest navigation is to the URL on screen", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse", "");
    store.startNavigationProgress("/dashboard");

    store.startNavigationProgress("/browse");

    expect(store.getNavigationProgress()).toEqual({ id: 1, isPending: false });
  });

  it("starts for a back or forward navigation to another URL", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse/abc", "");

    store.startNavigationProgress("http://localhost:3000/browse?page=2");

    expect(store.getNavigationProgress().isPending).toBe(true);
  });

  it("times out a navigation that never commits a new URL", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse");

    vi.advanceTimersByTime(store.NAVIGATION_PROGRESS_TIMEOUT_MS - 1);
    expect(store.getNavigationProgress().isPending).toBe(true);

    vi.advanceTimersByTime(1);
    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("restarts the timeout when another navigation overtakes", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse");
    vi.advanceTimersByTime(store.NAVIGATION_PROGRESS_TIMEOUT_MS - 1);

    store.startNavigationProgress("/dashboard");
    vi.advanceTimersByTime(store.NAVIGATION_PROGRESS_TIMEOUT_MS - 1);

    expect(store.getNavigationProgress().isPending).toBe(true);
  });
});

describe("stopNavigationProgress", () => {
  it("ends a pending navigation and keeps its id", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse");

    store.stopNavigationProgress();

    expect(store.getNavigationProgress()).toEqual({ id: 1, isPending: false });
  });

  it("does nothing while idle", async () => {
    const store = await loadStore();
    const idle = store.getNavigationProgress();
    const listener = vi.fn();
    store.subscribeNavigationProgress(listener);

    store.stopNavigationProgress();

    expect(store.getNavigationProgress()).toBe(idle);
    expect(listener).not.toHaveBeenCalled();
  });

  it("cancels the timeout", async () => {
    const store = await loadStore();
    const listener = vi.fn();
    store.startNavigationProgress("/browse");
    store.stopNavigationProgress();
    store.subscribeNavigationProgress(listener);

    vi.advanceTimersByTime(store.NAVIGATION_PROGRESS_TIMEOUT_MS);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("commitNavigationProgress", () => {
  it("ends a pending navigation", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse");

    store.commitNavigationProgress("/browse", "");

    expect(store.getNavigationProgress()).toEqual({ id: 1, isPending: false });
  });

  it("ends a navigation that was redirected somewhere else", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/dashboard");

    store.commitNavigationProgress("/login", "next=%2Fdashboard");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("keeps a bar that started before the first commit recorded the current page", async () => {
    const store = await loadStore();
    window.location.href = "http://localhost:3000/browse";
    store.startNavigationProgress("/browse/abc");

    store.commitNavigationProgress("/browse", "");
    expect(store.getNavigationProgress().isPending).toBe(true);

    store.commitNavigationProgress("/browse/abc", "");
    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("ends a bar when the first commit already shows a redirected destination", async () => {
    const store = await loadStore();
    window.location.href = "http://localhost:3000/";
    store.startNavigationProgress("/dashboard");

    store.commitNavigationProgress("/login", "next=%2Fdashboard");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("replaces the URL later navigations are compared against", async () => {
    const store = await loadStore();
    store.commitNavigationProgress("/browse", "");
    store.commitNavigationProgress("/dashboard", "");

    store.startNavigationProgress("/browse");

    expect(store.getNavigationProgress().isPending).toBe(true);
  });
});

describe("subscribeNavigationProgress", () => {
  it("notifies on start and on finish", async () => {
    const store = await loadStore();
    const listener = vi.fn();
    store.subscribeNavigationProgress(listener);

    store.startNavigationProgress("/browse");
    store.commitNavigationProgress("/browse", "");

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops notifying after unsubscribe", async () => {
    const store = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeNavigationProgress(listener);

    unsubscribe();
    store.startNavigationProgress("/browse");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("NAVIGATION_PROGRESS_TIMEOUT_MS", () => {
  it("outlasts a slow page load", async () => {
    const store = await loadStore();

    expect(store.NAVIGATION_PROGRESS_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("NavigationProgress", () => {
  it("renders an idle, decorative bar", async () => {
    const { bar } = await renderBar();

    expect(bar.props["aria-hidden"]).toBe("true");
    expect(bar.props["data-pending"]).toBe(false);
  });

  it("shows the bar while a navigation is pending", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse");

    const { bar } = await renderBar();

    expect(bar.props["data-pending"]).toBe(true);
  });

  it("remounts the segment for each new bar and keeps it through the fade", async () => {
    const store = await loadStore();
    const idle = await renderBar();
    store.startNavigationProgress("/browse");
    const pending = await renderBar();
    store.stopNavigationProgress();
    const finished = await renderBar();

    expect(pending.segment.key).not.toBe(idle.segment.key);
    expect(finished.segment.key).toBe(pending.segment.key);
  });

  it("ends the bar when the router commits the new URL", async () => {
    const store = await loadStore();
    store.startNavigationProgress("/browse?category=bridal");
    routerState.pathname = "/browse";
    routerState.search = "category=bridal";

    const { runTracker } = await renderBar();
    runTracker();

    expect(store.getNavigationProgress().isPending).toBe(false);
  });

  it("records the first URL so a link to the current page shows no bar", async () => {
    const store = await loadStore();
    routerState.pathname = "/browse";

    const { runTracker } = await renderBar();
    runTracker();
    store.startNavigationProgress("/browse");

    expect(store.getNavigationProgress().isPending).toBe(false);
  });
});

describe("onRouterTransitionStart", () => {
  it("starts the bar and still tells analytics about the navigation", async () => {
    const store = await loadStore();
    const { onRouterTransitionStart } = await import("@/instrumentation-client");

    onRouterTransitionStart("/browse");

    expect(mockInitAnalytics).toHaveBeenCalledTimes(1);
    expect(mockHandleRouterTransitionStart).toHaveBeenCalledWith("/browse");
    expect(store.getNavigationProgress().isPending).toBe(true);
  });
});
