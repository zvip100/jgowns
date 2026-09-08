import { beforeEach, describe, expect, it, vi } from "vitest";

import { WISHLIST_MAX_ITEMS, WISHLIST_STORAGE_KEY } from "@/lib/types";

import type { WishlistItem } from "@/lib/types";

type EffectRecord = {
  run: () => void | (() => void);
  dependencies: readonly unknown[] | undefined;
};

type SetterCall = {
  index: number;
  value: unknown;
};

type ServerPayload = {
  isAuthenticated: boolean;
  userId: string | null;
  items: WishlistItem[] | null;
};

const {
  hookState,
  mockAddToWishlist,
  mockMergeWishlist,
  mockRemoveFromWishlist,
  mockSetItem,
} = vi.hoisted(() => ({
  hookState: {
    effects: [] as EffectRecord[],
    refs: [] as { current: unknown }[],
    refCallCount: 0,
    setterCalls: [] as SetterCall[],
    stateCallCount: 0,
    stateValues: new Map<number, unknown>(),
  },
  mockAddToWishlist: vi.fn(),
  mockMergeWishlist: vi.fn(),
  mockRemoveFromWishlist: vi.fn(),
  mockSetItem: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useEffect: (
      run: () => void | (() => void),
      dependencies?: readonly unknown[],
    ): void => {
      hookState.effects.push({ run, dependencies });
    },
    useRef: <Value>(initial: Value): { current: Value } => {
      const index = hookState.refCallCount++;
      if (!hookState.refs[index]) {
        hookState.refs[index] = { current: initial };
      }
      return hookState.refs[index] as { current: Value };
    },
    useState: <State>(
      initial: State | (() => State),
    ): [State, (next: State | ((current: State) => State)) => void] => {
      const index = hookState.stateCallCount++;
      const initialValue =
        typeof initial === "function" ? (initial as () => State)() : initial;
      const value = hookState.stateValues.has(index)
        ? hookState.stateValues.get(index)
        : initialValue;
      const setState = (next: State | ((current: State) => State)): void => {
        hookState.setterCalls.push({ index, value: next });
      };
      return [value as State, setState];
    },
  };
});

vi.mock("@/lib/actions/wishlist", () => ({
  addToWishlist: mockAddToWishlist,
  mergeWishlist: mockMergeWishlist,
  removeFromWishlist: mockRemoveFromWishlist,
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { WishlistProvider } from "@/components/wishlist/WishlistProvider";

const USER_ID = "99999999-9999-9999-9999-999999999999";
const OTHER_USER_ID = "88888888-8888-8888-8888-888888888888";
const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_LISTING_ID = "22222222-2222-2222-2222-222222222222";

const ITEM: WishlistItem = {
  listingId: LISTING_ID,
  addedAt: "2026-08-26T00:00:00.000Z",
  status: "active",
  snapshot: {
    title: "Test Gown",
    priceLabel: "$400",
    image: null,
    blurDataUrl: null,
  },
};

function runReconcile(
  payload: ServerPayload,
  items: WishlistItem[],
  overrides: { ownerId?: string | null; lastSyncedIdentity?: string | null } = {},
): void {
  hookState.effects = [];
  hookState.refCallCount = 0;
  hookState.setterCalls = [];
  hookState.stateCallCount = 0;
  hookState.stateValues = new Map<number, unknown>([
    [0, items],
    [1, true],
    [2, payload.isAuthenticated],
    [3, false],
    [4, payload],
  ]);

  WishlistProvider({ children: null });

  if ("ownerId" in overrides) {
    hookState.refs[1].current = overrides.ownerId;
  }
  if ("lastSyncedIdentity" in overrides) {
    hookState.refs[4].current = overrides.lastSyncedIdentity;
  }

  hookState.effects[0]?.run();
  const reconciliation = hookState.effects.find(
    (effect) => effect.dependencies?.[1] === payload,
  );
  expect(reconciliation).toBeDefined();
  reconciliation?.run();
}

function setterValues(index: number): unknown[] {
  return hookState.setterCalls
    .filter((call) => call.index === index)
    .map((call) => call.value);
}

beforeEach(() => {
  hookState.refs = [];
  mockAddToWishlist.mockReset();
  mockMergeWishlist.mockReset();
  mockRemoveFromWishlist.mockReset();
  mockSetItem.mockReset();
  vi.stubGlobal("window", {
    localStorage: { setItem: mockSetItem },
  });
});

describe("WishlistProvider server reconciliation", () => {
  it("claims an unowned cache and leaves a failed authenticated read retryable", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [ITEM],
      { ownerId: null, lastSyncedIdentity: "signed-out" },
    );

    expect(hookState.refs[1]?.current).toBe(USER_ID);
    expect(hookState.refs[4]?.current).toBeNull();
    expect(mockSetItem).toHaveBeenCalledOnce();
    expect(mockSetItem.mock.calls[0]?.[0]).toBe(WISHLIST_STORAGE_KEY);
    expect(JSON.parse(mockSetItem.mock.calls[0]?.[1] as string)).toMatchObject({
      ownerId: USER_ID,
      items: [ITEM],
    });
  });

  it("processes a successful payload after a failed read with the same auth state", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [],
      { ownerId: null, lastSyncedIdentity: "signed-out" },
    );

    const successfulPayload: ServerPayload = {
      isAuthenticated: true,
      userId: USER_ID,
      items: [ITEM],
    };
    runReconcile(successfulPayload, []);

    expect(hookState.refs[4]?.current).toBe(USER_ID);
    expect(setterValues(0)).toContainEqual([ITEM]);
  });

  // Another tab swaps the shared session, and this tab's next payload goes
  // straight from one account to the other with no signed-out state between.
  // On a boolean guard the effect returned here, leaving A's items on screen
  // and A in the current-user ref while every write authenticated as B.
  it("reconciles a switch straight from one account to another", () => {
    const otherItem: WishlistItem = { ...ITEM, listingId: OTHER_LISTING_ID };

    runReconcile({ isAuthenticated: true, userId: USER_ID, items: [ITEM] }, [], {
      ownerId: null,
      lastSyncedIdentity: "signed-out",
    });

    runReconcile(
      { isAuthenticated: true, userId: OTHER_USER_ID, items: [otherItem] },
      [],
    );

    expect(hookState.refs[3]?.current).toBe(OTHER_USER_ID);
    expect(hookState.refs[1]?.current).toBe(OTHER_USER_ID);
    expect(hookState.refs[4]?.current).toBe(OTHER_USER_ID);
    expect(setterValues(0)).toContainEqual([otherItem]);
  });

  it("still processes sign-out after an authenticated read failure", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [],
      { ownerId: null, lastSyncedIdentity: "signed-out" },
    );

    runReconcile({ isAuthenticated: false, userId: null, items: null }, []);

    expect(hookState.refs[2]?.current).toBe(false);
    expect(hookState.refs[3]?.current).toBeNull();
    expect(hookState.refs[4]?.current).toBe("signed-out");
    expect(setterValues(2)).toContain(false);
  });

  it("does not reassign a cache that already belongs to another user", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [ITEM],
      { ownerId: OTHER_USER_ID, lastSyncedIdentity: "signed-out" },
    );

    expect(hookState.refs[1]?.current).toBe(OTHER_USER_ID);
    expect(hookState.refs[4]?.current).toBeNull();
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

/**
 * The 50-item cap is per device and per batch, not an account total: the
 * sign-in union merge can leave an account holding more. The status endpoint
 * rejects a request carrying more ids than the cap, so a merged list past it
 * used to get HTTP 400 on every refresh and never saw a sold gown go stale.
 */
describe("WishlistProvider status refresh", () => {
  function runRefresh(items: WishlistItem[]): void {
    hookState.effects = [];
    hookState.refCallCount = 0;
    hookState.setterCalls = [];
    hookState.stateCallCount = 0;
    hookState.stateValues = new Map<number, unknown>([
      [0, items],
      [1, true],
      [2, false],
      [3, true],
      [4, null],
    ]);

    WishlistProvider({ children: null });
    hookState.refs[0].current = items;

    const refresh = hookState.effects.find(
      (effect) =>
        effect.dependencies?.length === 2 && effect.dependencies[0] === true,
    );
    expect(refresh).toBeDefined();
    refresh?.run();
  }

  function requestedIds(call: unknown[]): string[] {
    const url = new URL(String(call[0]), "https://jgowns.test");
    return (url.searchParams.get("ids") ?? "").split(",");
  }

  it("splits a merged list past the cap into requests the endpoint accepts", () => {
    const items = Array.from({ length: WISHLIST_MAX_ITEMS + 10 }, (_, i) => ({
      ...ITEM,
      listingId: `listing-${i}`,
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    runRefresh(items);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedIds(fetchMock.mock.calls[0])).toHaveLength(
      WISHLIST_MAX_ITEMS,
    );
    expect(requestedIds(fetchMock.mock.calls[1])).toHaveLength(10);
  });

  it("asks once for a list that fits in a single request", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    runRefresh([ITEM]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestedIds(fetchMock.mock.calls[0])).toEqual([LISTING_ID]);
  });
});

/**
 * Analytics needs the real outcome of a toggle, not an assumption: an add is
 * rejected once the cap is hit, so the button must not report a save.
 */
describe("WishlistProvider toggle outcomes", () => {
  type WishlistContextValue = {
    toggleItem: (
      listingId: string,
      snapshot: WishlistItem["snapshot"],
      status: WishlistItem["status"],
    ) => "added" | "removed" | "rejected";
    removeItem: (listingId: string) => boolean;
  };

  function mountProvider(items: WishlistItem[]): WishlistContextValue {
    hookState.effects = [];
    hookState.refCallCount = 0;
    hookState.setterCalls = [];
    hookState.stateCallCount = 0;
    hookState.stateValues = new Map<number, unknown>([
      [0, items],
      [1, true],
      [2, false],
      [3, false],
      [4, null],
    ]);

    const element = WishlistProvider({ children: null }) as unknown as {
      props: { value: WishlistContextValue };
    };
    // itemsRef is populated by an effect, and toggleItem reads it, not state.
    hookState.effects[0]?.run();
    return element.props.value;
  }

  it("reports 'added' for a new save", () => {
    const context = mountProvider([]);
    expect(context.toggleItem(LISTING_ID, ITEM.snapshot, "active")).toBe("added");
  });

  it("reports 'removed' when the gown was already saved", () => {
    const context = mountProvider([ITEM]);
    expect(context.toggleItem(LISTING_ID, ITEM.snapshot, "active")).toBe(
      "removed",
    );
  });

  it("reports 'rejected' when the wishlist is full", () => {
    const full = Array.from({ length: WISHLIST_MAX_ITEMS }, (_, i) => ({
      ...ITEM,
      listingId: `listing-${i}`,
    }));
    const context = mountProvider(full);
    expect(context.toggleItem(LISTING_ID, ITEM.snapshot, "active")).toBe(
      "rejected",
    );
  });

  it("reports whether removeItem actually removed a row", () => {
    expect(mountProvider([ITEM]).removeItem(LISTING_ID)).toBe(true);
    expect(mountProvider([]).removeItem(LISTING_ID)).toBe(false);
  });
});
