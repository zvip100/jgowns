import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: unknown; count?: number | null };
type FilterCall = { table: string; method: string; args: unknown[] };

const {
  serverClient,
  serviceClient,
  calls,
  setTableResult,
  setRpcResult,
  setAuthUser,
  listUsers,
  getUserById,
  resetAdminMocks,
} = vi.hoisted(() => {
  const tableResults = new Map<string, QueryResult>();
  const rpcResults = new Map<string, QueryResult>();
  const filterCalls: FilterCall[] = [];
  let authUser: unknown = {
    id: "admin-1",
    email: "admin@jgowns.com",
    app_metadata: { role: "admin" },
  };

  const CHAIN_METHODS = [
    "select",
    "eq",
    "in",
    "gte",
    "lte",
    "ilike",
    "or",
    "order",
    "range",
    "limit",
    "maybeSingle",
  ];

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      chain[method] = vi.fn((...args: unknown[]) => {
        filterCalls.push({ table, method, args });
        return chain;
      });
    }
    // supabase-js filter builders are thenable, so awaiting anywhere in the
    // chain resolves. Mirroring that is what lets the same mock serve a query
    // that ends on .range() and one that ends on .maybeSingle().
    chain.then = (resolve: (value: QueryResult) => void) =>
      resolve(tableResults.get(table) ?? { data: [], error: null, count: 0 });
    return chain;
  }

  const listUsersMock = vi.fn();
  const getUserByIdMock = vi.fn();

  return {
    serverClient: {
      from: vi.fn((table: string) => makeChain(table)),
      rpc: vi.fn(async (name: string, args?: unknown) => {
        filterCalls.push({ table: `rpc:${name}`, method: "rpc", args: [args] });
        return rpcResults.get(name) ?? { data: null, error: null };
      }),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: authUser } })),
      },
    },
    serviceClient: {
      auth: { admin: { listUsers: listUsersMock, getUserById: getUserByIdMock } },
    },
    calls: filterCalls,
    setTableResult: (table: string, result: QueryResult) => {
      tableResults.set(table, result);
    },
    setRpcResult: (name: string, result: QueryResult) => {
      rpcResults.set(name, result);
    },
    setAuthUser: (user: unknown) => {
      authUser = user;
    },
    listUsers: listUsersMock,
    getUserById: getUserByIdMock,
    resetAdminMocks: () => {
      tableResults.clear();
      rpcResults.clear();
      filterCalls.length = 0;
      authUser = {
        id: "admin-1",
        email: "admin@jgowns.com",
        app_metadata: { role: "admin" },
      };
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(serverClient),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => serviceClient),
}));

import { requireAdmin } from "@/lib/admin/guard";
import {
  ADMIN_NEW_WEEK_SEGMENT,
  ADMIN_OFF_MARKET_STATUS,
  ADMIN_STALE_ACTIVE_SEGMENT,
} from "@/lib/admin/list";
import {
  getAdminListing,
  getAdminListings,
  getAdminListingsForUser,
} from "@/lib/queries/admin/listings";
import {
  getAdminAuditLog,
  getAuditLogForActor,
  getAuditLogForEntity,
  getAuditLogForListing,
  getRecentAuditLog,
} from "@/lib/queries/admin/logs";
import { getAdminMetrics } from "@/lib/queries/admin/metrics";
import {
  getAdminMessages,
  getOldestMessageAgeHours,
} from "@/lib/queries/admin/messages";
import { fetchStats, getAdminOverview } from "@/lib/queries/admin/overview";
import {
  getAdminPayments,
  getAdminPaymentsFor,
} from "@/lib/queries/admin/payments";
import {
  getAdminUser,
  getAdminUsers,
  resolveUserEmails,
} from "@/lib/queries/admin/users";

import type { AdminListParams } from "@/lib/admin/list";

const SELLER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const ASOF = "2026-07-31T18:00:00.000Z";

function params(overrides: Partial<AdminListParams> = {}): AdminListParams {
  return {
    status: "all",
    searchQuery: "",
    query: "",
    actor: "all",
    from: "",
    to: "",
    page: 1,
    ...overrides,
  };
}

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING_ID,
    user_id: SELLER_ID,
    title: "Ivory lace gown",
    status: "active",
    created_at: "2026-07-20T14:00:00.000Z",
    sizes: [{ id: "s1", size: "8", price: 400, status: "available" }],
    ...overrides,
  };
}

/** Filter/order/range calls recorded against one table, for predicate asserts. */
function callsFor(table: string): FilterCall[] {
  return calls.filter((call) => call.table === table);
}

function argsOf(table: string, method: string): unknown[][] {
  return callsFor(table)
    .filter((call) => call.method === method)
    .map((call) => call.args);
}

beforeEach(() => {
  resetAdminMocks();
  vi.clearAllMocks();
  setTableResult("admin_user_emails", { data: [], error: null });
  setRpcResult("admin_user_emails", {
    data: [{ id: SELLER_ID, email: "sara@example.com" }],
    error: null,
  });
  setRpcResult("admin_wishlist_counts", {
    data: { [LISTING_ID]: 12 },
    error: null,
  });
});

describe("requireAdmin", () => {
  it("returns the verified admin", async () => {
    await expect(requireAdmin()).resolves.toEqual({
      id: "admin-1",
      email: "admin@jgowns.com",
    });
  });

  it("rejects a signed-out caller", async () => {
    setAuthUser(null);
    await expect(requireAdmin()).rejects.toThrow("Not authorized");
  });

  it("rejects an authenticated non-admin", async () => {
    setAuthUser({ id: "u2", email: "seller@example.com", app_metadata: {} });
    await expect(requireAdmin()).rejects.toThrow("Not authorized");
  });

  it("uses getUser, not the local claim read, for the boundary", async () => {
    await requireAdmin();
    expect(serverClient.auth.getUser).toHaveBeenCalled();
  });
});

describe("getAdminListings", () => {
  beforeEach(() => {
    setTableResult("listings", {
      data: [listingRow()],
      error: null,
      count: 1,
    });
  });

  it("counts wishlist saves per listing and resolves the seller email", async () => {
    const result = await getAdminListings(params(), ASOF);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].saved_count).toBe(12);
    expect(result.rows[0].seller_email).toBe("sara@example.com");
    expect(serverClient.rpc).toHaveBeenCalledWith("admin_wishlist_counts", {
      p_listing_ids: [LISTING_ID],
    });
  });

  it("reports zero saves for a listing nobody saved", async () => {
    setRpcResult("admin_wishlist_counts", { data: {}, error: null });
    setTableResult("listings", {
      data: [listingRow({ sizes: null })],
      error: null,
      count: 1,
    });
    const result = await getAdminListings(params(), ASOF);

    expect(result.rows[0].saved_count).toBe(0);
    expect(result.rows[0].sizes).toEqual([]);
  });

  it("throws when the saved-count query fails", async () => {
    setRpcResult("admin_wishlist_counts", {
      data: null,
      error: { message: "boom" },
    });
    await expect(getAdminListings(params(), ASOF)).rejects.toThrow(
      "Failed to load saved counts",
    );
  });

  it("applies no status filter for the all segment", async () => {
    await getAdminListings(params(), ASOF);
    expect(argsOf("listings", "eq")).toEqual([]);
  });

  it("filters a plain status segment", async () => {
    await getAdminListings(params({ status: "sold" }), ASOF);
    expect(argsOf("listings", "eq")).toEqual([["status", "sold"]]);
  });

  it("expands the off-market segment to both statuses", async () => {
    await getAdminListings(params({ status: ADMIN_OFF_MARKET_STATUS }), ASOF);
    expect(argsOf("listings", "in")).toEqual([
      ["status", ["suspended", "removed"]],
    ]);
  });

  it("pairs an age segment's status with a rolling cutoff", async () => {
    await getAdminListings(params({ status: ADMIN_STALE_ACTIVE_SEGMENT }), ASOF);

    expect(argsOf("listings", "eq")).toEqual([["status", "active"]]);
    const [column, cutoff] = argsOf("listings", "lte")[0];
    expect(column).toBe("created_at");
    // 30 days before asOf, through the end of that day.
    expect(cutoff).toBe("2026-07-01T23:59:59.999Z");
  });

  it("looks forward from the cutoff for a newer age segment", async () => {
    await getAdminListings(params({ status: ADMIN_NEW_WEEK_SEGMENT }), ASOF);
    expect(argsOf("listings", "gte")).toEqual([
      ["created_at", "2026-07-24T00:00:00.000Z"],
    ]);
  });

  it("searches the title case-insensitively", async () => {
    await getAdminListings(params({ query: "lace" }), ASOF);
    expect(argsOf("listings", "ilike")).toEqual([["title", "%lace%"]]);
  });

  it("covers the whole end day of a date range", async () => {
    await getAdminListings(params({ from: "2026-01-01", to: "2026-02-01" }), ASOF);

    expect(argsOf("listings", "gte")).toEqual([
      ["created_at", "2026-01-01T00:00:00.000Z"],
    ]);
    expect(argsOf("listings", "lte")).toEqual([
      ["created_at", "2026-02-01T23:59:59.999Z"],
    ]);
  });

  it("orders newest first and requests the page range", async () => {
    // A count that actually spans the requested page, so the past-the-end
    // refetch does not fire and the assertion sees exactly one query.
    setTableResult("listings", { data: [listingRow()], error: null, count: 65 });
    await getAdminListings(params({ page: 2 }), ASOF);

    expect(argsOf("listings", "order")).toEqual([
      ["created_at", { ascending: false }],
    ]);
    expect(argsOf("listings", "range")).toEqual([[30, 59]]);
  });

  it("throws on a query error rather than reporting an empty list", async () => {
    setTableResult("listings", {
      data: null,
      error: { message: "boom", code: "42501" },
      count: null,
    });
    await expect(getAdminListings(params(), ASOF)).rejects.toThrow(
      "Failed to load listings",
    );
  });
});

describe("getAdminListing", () => {
  it("returns the mapped listing", async () => {
    setTableResult("listings", { data: listingRow(), error: null });
    const listing = await getAdminListing(LISTING_ID);

    expect(listing?.id).toBe(LISTING_ID);
    expect(listing?.seller_email).toBe("sara@example.com");
    expect(argsOf("listings", "eq")).toEqual([["id", LISTING_ID]]);
  });

  it("returns null for a missing row so the page can 404", async () => {
    setTableResult("listings", { data: null, error: null });
    await expect(getAdminListing("nope")).resolves.toBeNull();
  });

  it("throws on a query error", async () => {
    setTableResult("listings", {
      data: null,
      error: { message: "boom", code: "500" },
    });
    await expect(getAdminListing(LISTING_ID)).rejects.toThrow(
      "Failed to load listing",
    );
  });
});

describe("getAdminListingsForUser", () => {
  it("scopes to the seller and orders newest first", async () => {
    setTableResult("listings", { data: [listingRow()], error: null });
    const rows = await getAdminListingsForUser(SELLER_ID);

    expect(rows).toHaveLength(1);
    expect(argsOf("listings", "eq")).toEqual([["user_id", SELLER_ID]]);
    expect(argsOf("listings", "order")).toEqual([
      ["created_at", { ascending: false }],
    ]);
  });

  it("throws on a query error", async () => {
    setTableResult("listings", {
      data: null,
      error: { message: "boom" },
    });
    await expect(getAdminListingsForUser(SELLER_ID)).rejects.toThrow(
      "Failed to load seller listings",
    );
  });
});

describe("resolveUserEmails", () => {
  it("skips the round trip for an empty id list", async () => {
    await expect(resolveUserEmails([])).resolves.toEqual(new Map());
    expect(serverClient.rpc).not.toHaveBeenCalled();
  });

  it("deduplicates ids before asking", async () => {
    await resolveUserEmails([SELLER_ID, SELLER_ID]);
    expect(serverClient.rpc).toHaveBeenCalledWith("admin_user_emails", {
      p_ids: [SELLER_ID],
    });
  });

  it("drops rows with no email rather than mapping to undefined", async () => {
    setRpcResult("admin_user_emails", {
      data: [{ id: SELLER_ID, email: null }],
      error: null,
    });
    const emails = await resolveUserEmails([SELLER_ID]);
    expect(emails.has(SELLER_ID)).toBe(false);
  });

  it("throws on an RPC error", async () => {
    setRpcResult("admin_user_emails", {
      data: null,
      error: { message: "denied", code: "42501" },
    });
    await expect(resolveUserEmails([SELLER_ID])).rejects.toThrow(
      "Failed to resolve seller emails",
    );
  });
});

describe("getAdminUsers", () => {
  const authUserRow = (overrides: Record<string, unknown> = {}) => ({
    id: SELLER_ID,
    email: "sara@example.com",
    created_at: "2026-03-01T12:00:00.000Z",
    last_sign_in_at: "2026-07-30T18:00:00.000Z",
    app_metadata: { provider: "email" },
    user_metadata: { phone: "7185550101" },
    ...overrides,
  });

  beforeEach(() => {
    listUsers.mockResolvedValue({ data: { users: [authUserRow()] }, error: null });
    setTableResult("listings", {
      data: [
        { user_id: SELLER_ID, status: "active" },
        { user_id: SELLER_ID, status: "sold" },
        { user_id: SELLER_ID, status: "active" },
      ],
      error: null,
    });
  });

  it("maps an auth user onto the admin row shape", async () => {
    const result = await getAdminUsers(params());
    const [user] = result.rows;

    expect(user.email).toBe("sara@example.com");
    expect(user.provider).toBe("email");
    expect(user.phone).toBe("7185550101");
    expect(user.is_banned).toBe(false);
    expect(user.is_admin).toBe(false);
    expect(user.listing_counts).toEqual({
      active: 2,
      sold: 1,
      pending_payment: 0,
      suspended: 0,
      removed: 0,
    });
  });

  it("claim-checks before touching the service client", async () => {
    setAuthUser(null);
    await expect(getAdminUsers(params())).rejects.toThrow("Not authorized");
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("reads a google provider off app_metadata", async () => {
    listUsers.mockResolvedValue({
      data: { users: [authUserRow({ app_metadata: { provider: "google" } })] },
      error: null,
    });
    const result = await getAdminUsers(params());
    expect(result.rows[0].provider).toBe("google");
  });

  it("treats a future banned_until as banned", async () => {
    listUsers.mockResolvedValue({
      data: { users: [authUserRow({ banned_until: "2099-01-01T00:00:00Z" })] },
      error: null,
    });
    const result = await getAdminUsers(params());
    expect(result.rows[0].is_banned).toBe(true);
  });

  it("treats an elapsed banned_until as active again", async () => {
    listUsers.mockResolvedValue({
      data: { users: [authUserRow({ banned_until: "2020-01-01T00:00:00Z" })] },
      error: null,
    });
    const result = await getAdminUsers(params());
    expect(result.rows[0].is_banned).toBe(false);
  });

  it("reads the admin claim off app_metadata", async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [authUserRow({ app_metadata: { provider: "email", role: "admin" } })],
      },
      error: null,
    });
    const result = await getAdminUsers(params());
    expect(result.rows[0].is_admin).toBe(true);
  });

  it("filters the banned segment", async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [
          authUserRow(),
          authUserRow({ id: "u2", email: "b@x.com", banned_until: "2099-01-01T00:00:00Z" }),
        ],
      },
      error: null,
    });
    const result = await getAdminUsers(params({ status: "banned" }));
    expect(result.rows.map((u) => u.email)).toEqual(["b@x.com"]);
  });

  it("filters the admins segment", async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [
          authUserRow(),
          authUserRow({ id: "u3", email: "a@x.com", app_metadata: { role: "admin" } }),
        ],
      },
      error: null,
    });
    const result = await getAdminUsers(params({ status: "admin" }));
    expect(result.rows.map((u) => u.email)).toEqual(["a@x.com"]);
  });

  it("searches by email", async () => {
    listUsers.mockResolvedValue({
      data: { users: [authUserRow(), authUserRow({ id: "u4", email: "leah@x.com" })] },
      error: null,
    });
    const result = await getAdminUsers(params({ query: "leah" }));
    expect(result.rows.map((u) => u.email)).toEqual(["leah@x.com"]);
  });

  it("filters by join date, covering the whole end day", async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [
          authUserRow(),
          authUserRow({ id: "u5", email: "old@x.com", created_at: "2025-01-01T00:00:00Z" }),
        ],
      },
      error: null,
    });
    const result = await getAdminUsers(params({ from: "2026-03-01", to: "2026-03-01" }));
    expect(result.rows.map((u) => u.email)).toEqual(["sara@example.com"]);
  });

  it("orders newest join first", async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [
          authUserRow({ id: "u6", email: "older@x.com", created_at: "2026-01-01T00:00:00Z" }),
          authUserRow(),
        ],
      },
      error: null,
    });
    const result = await getAdminUsers(params());
    expect(result.rows.map((u) => u.email)).toEqual([
      "sara@example.com",
      "older@x.com",
    ]);
  });

  it("throws when the Auth Admin API fails", async () => {
    listUsers.mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(getAdminUsers(params())).rejects.toThrow("Failed to load users");
  });

  it("throws when the listing-count query fails", async () => {
    setTableResult("listings", { data: null, error: { message: "boom" } });
    await expect(getAdminUsers(params())).rejects.toThrow(
      "Failed to load listing counts",
    );
  });
});

describe("getAdminUser", () => {
  it("returns the mapped user with their listing counts", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: SELLER_ID,
          email: "sara@example.com",
          created_at: "2026-03-01T12:00:00.000Z",
          app_metadata: { provider: "email" },
          user_metadata: {},
        },
      },
      error: null,
    });
    setTableResult("listings", {
      data: [{ user_id: SELLER_ID, status: "removed" }],
      error: null,
    });

    const user = await getAdminUser(SELLER_ID);
    expect(user?.email).toBe("sara@example.com");
    expect(user?.phone).toBeNull();
    expect(user?.listing_counts.removed).toBe(1);
  });

  it("returns null for a missing account so the page can 404", async () => {
    getUserById.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(getAdminUser("nope")).resolves.toBeNull();
  });

  it("claim-checks first", async () => {
    setAuthUser(null);
    await expect(getAdminUser(SELLER_ID)).rejects.toThrow("Not authorized");
    expect(getUserById).not.toHaveBeenCalled();
  });
});

describe("getAdminMessages", () => {
  const message = {
    id: "m1",
    email: "buyer@example.com",
    message: "Hello",
    created_at: "2026-07-30T14:22:00.000Z",
  };

  it("returns the page and the total count", async () => {
    setTableResult("contact_messages", { data: [message], error: null, count: 1 });
    const result = await getAdminMessages(params());

    expect(result.rows).toEqual([message]);
    expect(result.totalCount).toBe(1);
  });

  it("searches by email and orders newest first", async () => {
    setTableResult("contact_messages", { data: [], error: null, count: 0 });
    await getAdminMessages(params({ query: "buyer" }));

    expect(argsOf("contact_messages", "ilike")).toEqual([["email", "%buyer%"]]);
    expect(argsOf("contact_messages", "order")).toEqual([
      ["created_at", { ascending: false }],
    ]);
  });

  it("applies both date bounds", async () => {
    setTableResult("contact_messages", { data: [], error: null, count: 0 });
    await getAdminMessages(params({ from: "2026-07-01", to: "2026-07-31" }));

    expect(argsOf("contact_messages", "gte")).toEqual([
      ["created_at", "2026-07-01T00:00:00.000Z"],
    ]);
    expect(argsOf("contact_messages", "lte")).toEqual([
      ["created_at", "2026-07-31T23:59:59.999Z"],
    ]);
  });

  it("throws on a query error", async () => {
    setTableResult("contact_messages", {
      data: null,
      error: { message: "boom" },
      count: null,
    });
    await expect(getAdminMessages(params())).rejects.toThrow(
      "Failed to load messages",
    );
  });
});

describe("getOldestMessageAgeHours", () => {
  it("returns whole elapsed hours", async () => {
    const twoHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
    setTableResult("contact_messages", {
      data: { created_at: twoHoursAgo },
      error: null,
    });
    await expect(getOldestMessageAgeHours()).resolves.toBe(2);
  });

  it("returns null for an empty inbox", async () => {
    setTableResult("contact_messages", { data: null, error: null });
    await expect(getOldestMessageAgeHours()).resolves.toBeNull();
  });

  it("throws on a query error", async () => {
    setTableResult("contact_messages", {
      data: null,
      error: { message: "boom" },
    });
    await expect(getOldestMessageAgeHours()).rejects.toThrow(
      "Failed to load oldest message",
    );
  });
});

describe("getAdminPayments", () => {
  const paymentRow = {
    id: "p1",
    listing_id: LISTING_ID,
    user_id: SELLER_ID,
    stripe_session_id: "cs_test_1",
    amount_cents: 500,
    currency: "usd",
    status: "succeeded",
    created_at: "2026-07-20T14:05:00.000Z",
    paid_at: "2026-07-20T14:06:00.000Z",
    listing: { title: "Ivory lace gown" },
  };

  it("flattens the listing embed and resolves the seller email", async () => {
    setTableResult("listing_payments", {
      data: [paymentRow],
      error: null,
      count: 1,
    });
    const result = await getAdminPayments(params());

    expect(result.rows[0].listing_title).toBe("Ivory lace gown");
    expect(result.rows[0].seller_email).toBe("sara@example.com");
    expect("listing" in result.rows[0]).toBe(false);
  });

  it("filters by payment status", async () => {
    setTableResult("listing_payments", { data: [], error: null, count: 0 });
    await getAdminPayments(params({ status: "pending" }));
    expect(argsOf("listing_payments", "eq")).toEqual([["status", "pending"]]);
  });

  it("searches the embedded listing title", async () => {
    setTableResult("listing_payments", { data: [], error: null, count: 0 });
    await getAdminPayments(params({ query: "lace" }));
    expect(argsOf("listing_payments", "ilike")).toEqual([
      ["listing.title", "%lace%"],
    ]);
  });

  it("throws on a query error", async () => {
    setTableResult("listing_payments", {
      data: null,
      error: { message: "boom" },
      count: null,
    });
    await expect(getAdminPayments(params())).rejects.toThrow(
      "Failed to load payments",
    );
  });
});

describe("getAdminPaymentsFor", () => {
  beforeEach(() => {
    setTableResult("listing_payments", { data: [], error: null });
  });

  it("scopes to one listing", async () => {
    await getAdminPaymentsFor({ listingId: LISTING_ID });
    expect(argsOf("listing_payments", "eq")).toEqual([
      ["listing_id", LISTING_ID],
    ]);
  });

  it("scopes to one seller", async () => {
    await getAdminPaymentsFor({ userId: SELLER_ID });
    expect(argsOf("listing_payments", "eq")).toEqual([["user_id", SELLER_ID]]);
  });

  it("throws on a query error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setTableResult("listing_payments", { data: null, error: { message: "boom" } });
    await expect(getAdminPaymentsFor({ userId: SELLER_ID })).rejects.toThrow(
      "Failed to load payment rows",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[queries/admin/payments] Failed to load payment rows",
      { message: "boom", code: undefined, scopeKind: "user" },
    );
    errorSpy.mockRestore();
  });
});

describe("getAdminAuditLog", () => {
  const entry = {
    id: "a1",
    actor_id: "admin-1",
    actor_email: "admin@jgowns.com",
    action: "listing.suspend",
    entity_type: "listing",
    entity_id: LISTING_ID,
    entity_label: "Ivory lace gown",
    reason: null,
    before: null,
    after: null,
    created_at: "2026-07-15T13:00:00.000Z",
  };

  it("returns an empty page before Phase 3 writes anything", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    const result = await getAdminAuditLog(params());

    expect(result.rows).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("returns rows once the table has them", async () => {
    setTableResult("admin_audit_log", { data: [entry], error: null, count: 1 });
    const result = await getAdminAuditLog(params());
    expect(result.rows[0].action).toBe("listing.suspend");
  });

  it("filters by entity type", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ status: "user" }));
    expect(argsOf("admin_audit_log", "eq")).toEqual([["entity_type", "user"]]);
  });

  it("filters by actor role", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ actor: "system" }));
    expect(argsOf("admin_audit_log", "eq")).toEqual([["actor_role", "system"]]);
  });

  it("filters on both axes at once, since entity and actor are independent", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ status: "listing", actor: "seller" }));

    expect(argsOf("admin_audit_log", "eq")).toEqual([
      ["entity_type", "listing"],
      ["actor_role", "seller"],
    ]);
  });

  it("leaves the actor unconstrained when it is all", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params());
    expect(argsOf("admin_audit_log", "eq")).toEqual([]);
  });

  it("orders newest first with the sequence tie-break", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params());

    expect(argsOf("admin_audit_log", "order")).toEqual([
      ["created_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
  });

  it("selects the actor role and sequence the UI needs", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params());

    const select = String(argsOf("admin_audit_log", "select")[0][0]);
    expect(select).toContain("actor_role");
    expect(select).toContain("sequence");
  });

  it("searches actor, action, and entity label", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ query: "ivory" }));

    expect(argsOf("admin_audit_log", "or")[0][0]).toBe(
      'actor_email.ilike."%ivory%",action.ilike."%ivory%",entity_label.ilike."%ivory%"',
    );
  });

  it("escapes reserved characters in the search value", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ query: 'ivory,"lace\\trim' }));

    expect(argsOf("admin_audit_log", "or")[0][0]).toBe(
      'actor_email.ilike."%ivory,\\"lace\\\\trim%",action.ilike."%ivory,\\"lace\\\\trim%",entity_label.ilike."%ivory,\\"lace\\\\trim%"',
    );
  });

  it("adds the slugs whose human label matched the search", async () => {
    setTableResult("admin_audit_log", { data: [], error: null, count: 0 });
    await getAdminAuditLog(params({ query: "suspended" }), ["listing.suspend"]);

    expect(argsOf("admin_audit_log", "or")[0][0]).toContain(
      "action.eq.listing.suspend",
    );
  });

  it("throws on a query error", async () => {
    setTableResult("admin_audit_log", {
      data: null,
      error: { message: "boom" },
      count: null,
    });
    await expect(getAdminAuditLog(params())).rejects.toThrow(
      "Failed to load audit log",
    );
  });
});

describe("getRecentAuditLog", () => {
  it("caps at the preview size and orders newest first", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getRecentAuditLog();

    expect(argsOf("admin_audit_log", "limit")).toEqual([[10]]);
    expect(argsOf("admin_audit_log", "order")).toEqual([
      ["created_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
  });

  it("honours an explicit limit", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getRecentAuditLog(3);
    expect(argsOf("admin_audit_log", "limit")).toEqual([[3]]);
  });

  it("throws on a query error", async () => {
    setTableResult("admin_audit_log", { data: null, error: { message: "boom" } });
    await expect(getRecentAuditLog()).rejects.toThrow("Failed to load audit log");
  });
});

describe("getAuditLogForEntity", () => {
  it("scopes to one entity", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getAuditLogForEntity("listing", LISTING_ID);

    expect(argsOf("admin_audit_log", "eq")).toEqual([
      ["entity_type", "listing"],
      ["entity_id", LISTING_ID],
    ]);
  });

  it("throws on a query error", async () => {
    setTableResult("admin_audit_log", { data: null, error: { message: "boom" } });
    await expect(getAuditLogForEntity("user", SELLER_ID)).rejects.toThrow(
      "Failed to load audit log",
    );
  });
});

describe("getAuditLogForListing", () => {
  // Payment rows carry entity_type 'payment' so the logs page can route them to
  // /admin/payments, which is exactly what would hide them from this timeline.
  it("takes the listing's own events and its payment events", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getAuditLogForListing(LISTING_ID);

    expect(argsOf("admin_audit_log", "in")).toEqual([
      ["entity_type", ["listing", "payment"]],
    ]);
    expect(argsOf("admin_audit_log", "eq")).toEqual([
      ["entity_id", LISTING_ID],
    ]);
  });

  it("orders newest first with the sequence tie-break", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getAuditLogForListing(LISTING_ID);

    expect(argsOf("admin_audit_log", "order")).toEqual([
      ["created_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
  });

  it("throws on a query error", async () => {
    setTableResult("admin_audit_log", { data: null, error: { message: "boom" } });
    await expect(getAuditLogForListing(LISTING_ID)).rejects.toThrow(
      "Failed to load audit log",
    );
  });
});

describe("getAuditLogForActor", () => {
  it("scopes to one actor and caps at the page size", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getAuditLogForActor(SELLER_ID);

    expect(argsOf("admin_audit_log", "eq")).toEqual([["actor_id", SELLER_ID]]);
    expect(argsOf("admin_audit_log", "limit")).toEqual([[30]]);
    expect(argsOf("admin_audit_log", "order")).toEqual([
      ["created_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
  });

  it("honours an explicit limit", async () => {
    setTableResult("admin_audit_log", { data: [], error: null });
    await getAuditLogForActor(SELLER_ID, 5);
    expect(argsOf("admin_audit_log", "limit")).toEqual([[5]]);
  });

  it("throws on a query error", async () => {
    setTableResult("admin_audit_log", { data: null, error: { message: "boom" } });
    await expect(getAuditLogForActor(SELLER_ID)).rejects.toThrow(
      "Failed to load audit log",
    );
  });
});

describe("getAdminOverview", () => {
  const stats = {
    active_listings: 2,
    sold_listings: 1,
    suspended_or_removed: 0,
    pending_payment: 1,
    total_gowns: 4,
    users_total: 5,
    new_listings_this_week: 1,
    sold_this_week: 0,
    new_users_this_week: 0,
    fees_collected_this_week_cents: 500,
    contact_messages_total: 3,
    oldest_contact_message_age_hours: 150,
  };

  beforeEach(() => {
    setRpcResult("admin_overview_stats", { data: stats, error: null });
    setTableResult("listings", { data: [listingRow()], error: null, count: 1 });
    setTableResult("admin_audit_log", { data: [], error: null });
  });

  it("returns the stats and one queue per attention card", async () => {
    const overview = await getAdminOverview();

    expect(overview.stats).toEqual(stats);
    expect(overview.newThisWeek.count).toBe(1);
    expect(overview.staleActives.count).toBe(1);
    expect(overview.offMarket.count).toBe(1);
    expect(overview.stuckPending.count).toBe(1);
    expect(overview.recentActivity).toEqual([]);
  });

  it("stamps one asOf the whole page shares", async () => {
    const overview = await getAdminOverview();
    expect(Number.isNaN(Date.parse(overview.asOf))).toBe(false);
  });

  it("throws when the stats RPC fails", async () => {
    setRpcResult("admin_overview_stats", {
      data: null,
      error: { message: "denied", code: "42501" },
    });
    await expect(getAdminOverview()).rejects.toThrow(
      "Failed to load overview stats",
    );
  });
});

describe("fetchStats", () => {
  it("returns the shared overview stats", async () => {
    const stats = { active_listings: 2 };
    setRpcResult("admin_overview_stats", { data: stats, error: null });
    await expect(fetchStats()).resolves.toEqual(stats);
  });

  it("rejects a null RPC payload", async () => {
    setRpcResult("admin_overview_stats", { data: null, error: null });
    await expect(fetchStats()).rejects.toThrow("Failed to load overview stats");
  });
});

describe("getAdminMetrics", () => {
  const summary = {
    category_share: [{ category: "bridal", count: 12 }],
    location_share: [{ location: "Lakewood", count: 9 }],
    price_bands: [{ band: "under_100", count: 3 }],
    condition_mix: { "Brand New": 4 },
    sell_mode_mix: { individual: 5 },
    median_time_to_sold_days: 18.5,
    most_wishlisted: { id: LISTING_ID, title: "Ivory lace gown", saves: 12 },
    actives_with_no_available_size: 0,
    payments: { attempts: 4, succeeded: 2, pending: 1, expired: 1 },
  };

  beforeEach(() => {
    setRpcResult("admin_overview_stats", { data: {}, error: null });
    setRpcResult("admin_metrics_summary", { data: summary, error: null });
    setRpcResult("admin_metrics_series", {
      data: [
        {
          week_start: "2026-07-27",
          listings_created: "4",
          listings_sold: "1",
          new_users: "2",
          fees_collected_cents: "1500",
        },
      ],
      error: null,
    });
  });

  it("labels each week in UTC so a bare date never shifts a day", async () => {
    const metrics = await getAdminMetrics();
    expect(metrics.series[0].week).toBe("Jul 27");
  });

  it("coerces bigint counts arriving as strings", async () => {
    const metrics = await getAdminMetrics();
    expect(metrics.series[0]).toMatchObject({
      listings_created: 4,
      listings_sold: 1,
      new_users: 2,
      fees_collected_cents: 1500,
    });
  });

  it("asks for the charted window", async () => {
    await getAdminMetrics();
    expect(serverClient.rpc).toHaveBeenCalledWith("admin_metrics_series", {
      p_weeks: 12,
    });
  });

  it("passes the summary through", async () => {
    const metrics = await getAdminMetrics();
    expect(metrics.summary).toEqual(summary);
  });

  it("throws when the series RPC fails", async () => {
    setRpcResult("admin_metrics_series", {
      data: null,
      error: { message: "denied" },
    });
    await expect(getAdminMetrics()).rejects.toThrow("Failed to load metrics series");
  });

  it("throws when the summary RPC fails", async () => {
    setRpcResult("admin_metrics_summary", {
      data: null,
      error: { message: "denied" },
    });
    await expect(getAdminMetrics()).rejects.toThrow(
      "Failed to load metrics summary",
    );
  });

  it("throws when the summary RPC returns no data", async () => {
    setRpcResult("admin_metrics_summary", { data: null, error: null });
    await expect(getAdminMetrics()).rejects.toThrow(
      "Failed to load metrics summary",
    );
  });
});
