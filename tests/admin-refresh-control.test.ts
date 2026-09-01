import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_REFRESH_INTERVAL_MS } from "@/app/(admin)/admin-refresh";

type Listener = () => void;

type EffectSlot = {
  deps: readonly unknown[] | undefined;
  cleanup: (() => void) | undefined;
};

const { hookState, mockRefresh, routerState } = vi.hoisted(() => ({
  hookState: {
    states: [] as unknown[],
    refs: [] as { current: unknown }[],
    callbacks: [] as { value: unknown; deps: readonly unknown[] }[],
    effects: [] as {
      run: () => void | (() => void);
      deps: readonly unknown[] | undefined;
    }[],
    stateIndex: 0,
    refIndex: 0,
    callbackIndex: 0,
    isPending: false,
    isDirty: false,
    contextValue: null as unknown,
  },
  mockRefresh: vi.fn(),
  routerState: { pathname: "/admin", search: "" },
}));

function areDepsEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (!previous || !next) return false;
  if (previous.length !== next.length) return false;
  return previous.every((value, index) => Object.is(value, next[index]));
}

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(
      callback: Callback,
      deps: readonly unknown[],
    ): Callback => {
      const index = hookState.callbackIndex++;
      const previous = hookState.callbacks[index];
      if (previous && areDepsEqual(previous.deps, deps)) {
        return previous.value as Callback;
      }
      hookState.callbacks[index] = { value: callback, deps };
      return callback;
    },
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refIndex++;
      if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
      return hookState.refs[index] as { current: Value };
    },
    useState: <State>(
      initial: State,
    ): [State, (next: State | ((current: State) => State)) => void] => {
      const index = hookState.stateIndex++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      const setState = (next: State | ((current: State) => State)): void => {
        const value =
          typeof next === "function"
            ? (next as (current: State) => State)(
                hookState.states[index] as State,
              )
            : next;
        if (Object.is(value, hookState.states[index])) return;
        hookState.states[index] = value;
        hookState.isDirty = true;
      };
      return [hookState.states[index] as State, setState];
    },
    useEffect: (
      run: () => void | (() => void),
      deps?: readonly unknown[],
    ): void => {
      hookState.effects.push({ run, deps });
    },
    useContext: <Value>(): Value => hookState.contextValue as Value,
    // Mirrors the real lifecycle: starting a transition makes it pending until
    // the test settles it, so no test has to assert the pending flag into place.
    useTransition: (): [boolean, (callback: () => void) => void] => [
      hookState.isPending,
      (callback: () => void) => {
        hookState.isPending = true;
        hookState.isDirty = true;
        callback();
      },
    ],
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => routerState.pathname,
  useSearchParams: () => new URLSearchParams(routerState.search),
  useRouter: () => router,
}));

const router = { refresh: mockRefresh };

import { AdminRefreshControl } from "@/app/(admin)/AdminRefreshControl";
import { AdminRefreshProvider } from "@/app/(admin)/AdminRefreshProvider";

const NOW = Date.UTC(2026, 7, 27, 15, 42, 0);

/** Timing assertions stay relative so they hold whatever the interval is set to. */
const HALF_INTERVAL_MS = Math.round(ADMIN_REFRESH_INTERVAL_MS / 2);

function makeEventTarget() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    listeners,
    addEventListener(type: string, listener: Listener): void {
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: Listener): void {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string): void {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    count(type: string): number {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

let windowStub: ReturnType<typeof makeEventTarget> & {
  location: { pathname: string; search: string };
};
let documentStub: ReturnType<typeof makeEventTarget> & {
  visibilityState: "visible" | "hidden";
};
let effectSlots: EffectSlot[] = [];
let element: unknown = null;

type RenderedNode = { type: unknown; props: Record<string, unknown> };

function collect(node: unknown, out: RenderedNode[] = []): RenderedNode[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const candidate = node as { type?: unknown; props?: Record<string, unknown> };
  if (!("type" in candidate)) return out;
  const props = candidate.props ?? {};
  out.push({ type: candidate.type, props });
  collect(props.children, out);
  return out;
}

function findButton(): RenderedNode {
  const button = collect(element).find((node) => node.type === "button");
  if (!button) throw new Error("no button rendered");
  return button;
}

function findTime(): RenderedNode | undefined {
  return collect(element).find((node) => node.type === "time");
}

function renderOnce(): void {
  hookState.stateIndex = 0;
  hookState.refIndex = 0;
  hookState.callbackIndex = 0;
  hookState.effects = [];
  const provider = AdminRefreshProvider({ children: null }) as RenderedNode;
  hookState.contextValue = provider.props.value;
  const tracker = collect(provider).find(
    (node) =>
      typeof node.type === "function" &&
      node.type.name === "AdminRefreshRouteTracker",
  );
  if (!tracker || typeof tracker.type !== "function") {
    throw new Error("no route tracker rendered");
  }
  tracker.type(tracker.props);
  element = AdminRefreshControl();
}

function commit(): void {
  hookState.effects.forEach((effect, index) => {
    const slot = effectSlots[index];
    if (slot && areDepsEqual(slot.deps, effect.deps)) return;
    slot?.cleanup?.();
    const cleanup = effect.run();
    effectSlots[index] = {
      deps: effect.deps,
      cleanup: typeof cleanup === "function" ? cleanup : undefined,
    };
  });
}

/** Renders until the state settles, the way React flushes an effect's setState. */
function flush(): void {
  let guard = 0;
  do {
    hookState.isDirty = false;
    renderOnce();
    commit();
  } while (hookState.isDirty && guard++ < 20);
}

/** A flush plus the task the route effect defers its decision to. */
function act(): void {
  flush();
  vi.advanceTimersByTime(0);
  flush();
}

function unmount(): void {
  for (const slot of effectSlots) slot?.cleanup?.();
  effectSlots = [];
}

/** Renders the pending state a started transition produces, then resolves it. */
function settleRefresh(): void {
  flush();
  hookState.isPending = false;
  act();
}

function clickRefresh(): void {
  (findButton().props.onClick as () => void)();
  flush();
}

function lastRefreshedAt(): number | null {
  return hookState.states[0] as number | null;
}

beforeEach(() => {
  hookState.states = [];
  hookState.refs = [];
  hookState.callbacks = [];
  hookState.effects = [];
  hookState.isPending = false;
  hookState.isDirty = false;
  hookState.contextValue = null;
  effectSlots = [];
  element = null;
  routerState.pathname = "/admin";
  routerState.search = "";
  mockRefresh.mockReset();

  windowStub = Object.assign(makeEventTarget(), {
    location: { pathname: "/admin", search: "" },
  });
  documentStub = Object.assign(makeEventTarget(), {
    visibilityState: "visible" as "visible" | "hidden",
  });
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("document", documentStub);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function navigateTo(pathname: string, search = ""): void {
  routerState.pathname = pathname;
  routerState.search = search;
  windowStub.location = { pathname, search };
  act();
}

function popStateTo(pathname: string, search = ""): void {
  windowStub.location = { pathname, search };
  windowStub.emit("popstate");
}

describe("AdminRefreshControl mount", () => {
  it("takes its timestamp from an effect, not from render", () => {
    renderOnce();

    expect(lastRefreshedAt()).toBeNull();
    expect(findTime()).toBeUndefined();

    act();

    expect(lastRefreshedAt()).toBe(NOW);
    expect(findTime()?.props.dateTime).toBe("2026-08-27T15:42:00.000Z");
  });

  it("does not refresh on mount", () => {
    act();

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("AdminRefreshControl manual refresh", () => {
  it("refreshes once per activation", () => {
    act();

    clickRefresh();

    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("ignores repeat activations while a refresh is in flight", () => {
    act();
    const click = findButton().props.onClick as () => void;

    click();
    click();
    click();

    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("stamps the time only once the transition finishes", () => {
    act();
    vi.setSystemTime(NOW + 60_000);

    clickRefresh();
    expect(lastRefreshedAt()).toBe(NOW);

    settleRefresh();
    expect(lastRefreshedAt()).toBe(NOW + 60_000);
  });

  it("accepts a new activation after the previous one completes", () => {
    act();
    clickRefresh();
    settleRefresh();

    clickRefresh();

    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("marks the button busy and spins the icon while pending", () => {
    act();
    clickRefresh();

    const button = findButton();
    expect(button.props["aria-label"]).toBe("Refresh admin data");
    expect(button.props.disabled).toBe(true);
    expect(button.props["aria-busy"]).toBe(true);
    expect(
      collect(element).some((node) =>
        String(node.props.className ?? "").includes("animate-spin"),
      ),
    ).toBe(true);
  });

  it("leaves the button enabled and the icon still when idle", () => {
    act();

    const button = findButton();
    expect(button.props.disabled).toBe(false);
    expect(button.props["aria-busy"]).toBe(false);
    expect(
      collect(element).some((node) =>
        String(node.props.className ?? "").includes("animate-spin"),
      ),
    ).toBe(false);
  });
});

describe("AdminRefreshControl automatic refresh", () => {
  it("refreshes a visible page after the interval", () => {
    act();

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS);

    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("restarts the interval from the completed refresh", () => {
    act();
    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS);
    vi.setSystemTime(NOW + ADMIN_REFRESH_INTERVAL_MS);
    settleRefresh();

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - 1);
    expect(mockRefresh).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("holds off while the tab is hidden and catches up when it returns", () => {
    act();
    documentStub.visibilityState = "hidden";

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS);
    expect(mockRefresh).not.toHaveBeenCalled();

    documentStub.visibilityState = "visible";
    documentStub.emit("visibilitychange");

    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});

describe("AdminRefreshControl navigation", () => {
  it("restamps a pathname change without refreshing again", () => {
    act();
    vi.setSystemTime(NOW + 300_000);

    navigateTo("/admin/listings");

    expect(lastRefreshedAt()).toBe(NOW + 300_000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("restamps a filter change without refreshing again", () => {
    act();
    vi.setSystemTime(NOW + 120_000);

    navigateTo("/admin", "status=active&page=2");

    expect(lastRefreshedAt()).toBe(NOW + 120_000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("restarts the interval from a query-only navigation", () => {
    act();
    vi.advanceTimersByTime(HALF_INTERVAL_MS);
    navigateTo("/admin", "status=active&page=2");

    // The old deadline lands here and must not fire against the new query.
    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - HALF_INTERVAL_MS);
    expect(mockRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(HALF_INTERVAL_MS);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("restarts the interval from the navigation", () => {
    act();
    vi.advanceTimersByTime(HALF_INTERVAL_MS);
    navigateTo("/admin/listings");

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - 1);
    expect(mockRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});

describe("AdminRefreshControl history restore", () => {
  it("restores the route's own time instead of refreshing it", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/listings");
    expect(lastRefreshedAt()).toBe(NOW + 60_000);

    // Back to /admin, whose payload the router restores from its cache.
    vi.setSystemTime(NOW + 600_000);
    popStateTo("/admin");
    navigateTo("/admin");

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastRefreshedAt()).toBe(NOW);
  });

  it("restores when popstate lands after the router already committed", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/listings");

    // The live ordering: Next commits the restored route, then the window
    // listener runs, then the deferred decision is made.
    vi.setSystemTime(NOW + 600_000);
    routerState.pathname = "/admin";
    windowStub.location = { pathname: "/admin", search: "" };
    flush();
    windowStub.emit("popstate");
    act();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastRefreshedAt()).toBe(NOW);
  });

  it("refreshes a restored page immediately once it is past the interval", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/listings");

    // Back to a page whose data is now older than the interval.
    vi.setSystemTime(NOW + ADMIN_REFRESH_INTERVAL_MS + 60_000);
    popStateTo("/admin");
    navigateTo("/admin");

    expect(lastRefreshedAt()).toBe(NOW);
    vi.advanceTimersByTime(0);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("leaves a restored page alone while it is still inside the interval", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/listings");

    vi.setSystemTime(NOW + HALF_INTERVAL_MS);
    popStateTo("/admin");
    navigateTo("/admin");

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS - HALF_INTERVAL_MS - 1);
    expect(mockRefresh).not.toHaveBeenCalled();

    // The deadline is measured from the restored time, not from the return.
    vi.advanceTimersByTime(1);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("stamps a restore of a route it has no memory of", () => {
    act();
    vi.setSystemTime(NOW + 90_000);

    popStateTo("/admin/logs");
    navigateTo("/admin/logs");

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastRefreshedAt()).toBe(NOW + 90_000);
  });

  it("spends a restore mark only on the route it was armed for", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/users");

    popStateTo("/admin");
    // An ordinary navigation elsewhere overtakes the deferred decision.
    vi.setSystemTime(NOW + 90_000);
    navigateTo("/admin/listings");

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastRefreshedAt()).toBe(NOW + 90_000);
  });

  it("treats a same-URL history entry as no restore at all", () => {
    act();
    vi.setSystemTime(NOW + 60_000);

    popStateTo("/admin");
    navigateTo("/admin/users");

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(lastRefreshedAt()).toBe(NOW + 60_000);
  });

  it("does not refresh on a same-URL history entry followed by a navigation", () => {
    act();

    popStateTo("/admin");
    navigateTo("/admin/users");

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("does not carry an unspent restore mark into a later navigation", () => {
    act();
    vi.setSystemTime(NOW + 60_000);
    navigateTo("/admin/users");

    // Armed for /admin, then spent by the navigation that overtakes it.
    popStateTo("/admin");
    vi.setSystemTime(NOW + 90_000);
    navigateTo("/admin/listings");

    vi.setSystemTime(NOW + 120_000);
    navigateTo("/admin");

    expect(lastRefreshedAt()).toBe(NOW + 120_000);
  });
});

describe("AdminRefreshControl teardown", () => {
  it("removes its listeners and timers on unmount", () => {
    act();

    expect(windowStub.count("popstate")).toBe(1);
    expect(documentStub.count("visibilitychange")).toBe(1);

    unmount();

    expect(windowStub.count("popstate")).toBe(0);
    expect(documentStub.count("visibilitychange")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(ADMIN_REFRESH_INTERVAL_MS * 2);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("keeps exactly one interval timer armed across re-renders", () => {
    act();
    act();
    navigateTo("/admin/logs");
    act();

    expect(vi.getTimerCount()).toBe(1);
  });
});
