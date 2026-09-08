import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WishlistItem } from "@/lib/types";

const { mockGetCurrentUser, mockGetUserWishlist } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetUserWishlist: vi.fn(),
}));

vi.mock("@/lib/queries/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/queries/wishlist", () => ({ getUserWishlist: mockGetUserWishlist }));
// Only the props matter here; the real hydrator is a client leaf with its own
// coverage. `next/navigation` is deliberately NOT mocked, so the assertions
// below run against the real unstable_rethrow.
vi.mock("@/components/wishlist/WishlistHydrator", () => ({
  WishlistHydrator: (props: unknown) => props,
}));

import WishlistServerSync from "@/components/wishlist/WishlistServerSync";

const USER = { id: "99999999-9999-9999-9999-999999999999" };

const ITEM: WishlistItem = {
  listingId: "11111111-1111-1111-1111-111111111111",
  addedAt: "2026-08-26T00:00:00.000Z",
  status: "active",
  snapshot: {
    title: "Test Gown",
    priceLabel: "$400",
    image: null,
    blurDataUrl: null,
  },
};

/**
 * What Next throws when a prerender completes while a dynamic read is still
 * outstanding. Identified by the digest alone (next/dist/server/
 * dynamic-rendering-utils), which is what unstable_rethrow matches on.
 */
function hangingPromiseRejection(): Error {
  const error = new Error(
    'During prerendering, `cookies()` rejects when the prerender is complete. This occurred at route "/browse".',
  );
  Object.assign(error, { digest: "HANGING_PROMISE_REJECTION" });
  return error;
}

async function renderProps(): Promise<Record<string, unknown>> {
  const element = (await WishlistServerSync()) as { props: Record<string, unknown> };
  return element.props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WishlistServerSync", () => {
  it("reports a signed-out visitor without reading any account list", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(renderProps()).resolves.toEqual({
      isAuthenticated: false,
      userId: null,
      serverItems: null,
    });
    expect(mockGetUserWishlist).not.toHaveBeenCalled();
  });

  it("hands the account's own list to the hydrator", async () => {
    mockGetCurrentUser.mockResolvedValue(USER);
    mockGetUserWishlist.mockResolvedValue([ITEM]);

    await expect(renderProps()).resolves.toEqual({
      isAuthenticated: true,
      userId: USER.id,
      serverItems: [ITEM],
    });
    // The verified id, never a client-supplied one: the admin-wide select
    // policy would otherwise return every user's rows.
    expect(mockGetUserWishlist).toHaveBeenCalledWith(USER.id);
  });

  it("degrades to null on a real read failure instead of tripping the boundary", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue(USER);
    mockGetUserWishlist.mockRejectedValue(new Error("connection failed"));

    await expect(renderProps()).resolves.toEqual({
      isAuthenticated: true,
      userId: USER.id,
      serverItems: null,
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("degrades to signed-out when the auth read itself fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockRejectedValue(new Error("auth unreachable"));

    await expect(renderProps()).resolves.toEqual({
      isAuthenticated: false,
      userId: null,
      serverItems: null,
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // A prerender abandoning this read is framework control flow, not a failure.
  // It fired on every prerendered route, so logging it buried the case above.
  it("rethrows a prerender abandonment without logging it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockRejectedValue(hangingPromiseRejection());

    await expect(WishlistServerSync()).rejects.toMatchObject({
      digest: "HANGING_PROMISE_REJECTION",
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("rethrows a prerender abandonment from the wishlist read too", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue(USER);
    mockGetUserWishlist.mockRejectedValue(hangingPromiseRejection());

    await expect(WishlistServerSync()).rejects.toMatchObject({
      digest: "HANGING_PROMISE_REJECTION",
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
