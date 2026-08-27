import { beforeEach, describe, expect, it, vi } from "vitest";

import { WISHLIST_STORAGE_KEY } from "@/lib/types";

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
  overrides: { ownerId?: string | null; lastSyncedAuth?: boolean | null } = {},
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
  if ("lastSyncedAuth" in overrides) {
    hookState.refs[4].current = overrides.lastSyncedAuth;
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
      { ownerId: null, lastSyncedAuth: false },
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
      { ownerId: null, lastSyncedAuth: false },
    );

    const successfulPayload: ServerPayload = {
      isAuthenticated: true,
      userId: USER_ID,
      items: [ITEM],
    };
    runReconcile(successfulPayload, []);

    expect(hookState.refs[4]?.current).toBe(true);
    expect(setterValues(0)).toContainEqual([ITEM]);
  });

  it("still processes sign-out after an authenticated read failure", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [],
      { ownerId: null, lastSyncedAuth: false },
    );

    runReconcile({ isAuthenticated: false, userId: null, items: null }, []);

    expect(hookState.refs[2]?.current).toBe(false);
    expect(hookState.refs[3]?.current).toBeNull();
    expect(hookState.refs[4]?.current).toBe(false);
    expect(setterValues(2)).toContain(false);
  });

  it("does not reassign a cache that already belongs to another user", () => {
    runReconcile(
      { isAuthenticated: true, userId: USER_ID, items: null },
      [ITEM],
      { ownerId: OTHER_USER_ID, lastSyncedAuth: false },
    );

    expect(hookState.refs[1]?.current).toBe(OTHER_USER_ID);
    expect(hookState.refs[4]?.current).toBeNull();
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
