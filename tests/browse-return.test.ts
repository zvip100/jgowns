import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type BrowseReturn = typeof import("@/lib/browse-return");
type Entry = { url: string | null };
type WindowOptions = {
  pathname?: string;
  search?: string;
  scrollY?: number;
  navigation?: { currentEntry: { index: number } | null; entries: () => Entry[] };
};

const KEY = "jgowns:browse-return";
const GOWN_PATH = "/browse/11111111-1111-4111-8111-111111111111";

let store: Map<string, string>;
let storage: {
  getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>;
  setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
  removeItem: ReturnType<typeof vi.fn<(key: string) => void>>;
};
let warn: ReturnType<typeof vi.spyOn>;

function stubWindow({
  pathname = "/browse",
  search = "",
  scrollY = 0,
  navigation,
}: WindowOptions = {}): void {
  vi.stubGlobal("window", {
    location: { pathname, search, href: `http://localhost:3000${pathname}${search}` },
    scrollY,
    sessionStorage: storage,
    navigation,
  });
}

async function load(): Promise<BrowseReturn> {
  return import("@/lib/browse-return");
}

function saved(): unknown {
  const raw = store.get(KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

beforeEach(() => {
  vi.resetModules();
  store = new Map();
  storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.unstubAllGlobals();
});

describe("trackBrowseReturn", () => {
  it("saves the list position when a gown is opened from the list", async () => {
    stubWindow({ search: "?category=bridal&page=2", scrollY: 2330 });
    const { BROWSE_RETURN_STORAGE_KEY, trackBrowseReturn } = await load();

    trackBrowseReturn(`${GOWN_PATH}?back=category%3Dbridal%26page%3D2`, "push");

    expect(BROWSE_RETURN_STORAGE_KEY).toBe(KEY);
    expect(saved()).toEqual({
      detailPath: GOWN_PATH,
      search: "?category=bridal&page=2",
      scrollY: 2330,
    });
  });

  it("accepts an absolute gown URL", async () => {
    stubWindow({ scrollY: 40 });
    const { trackBrowseReturn } = await load();

    trackBrowseReturn(`http://localhost:3000${GOWN_PATH}`, "push");

    expect(saved()).toEqual({ detailPath: GOWN_PATH, search: "", scrollY: 40 });
  });

  it.each([
    ["a replace", GOWN_PATH, "replace", "/browse"],
    ["a traversal", GOWN_PATH, "traverse", "/browse"],
    ["a push to another list page", "/browse?page=2", "push", "/browse"],
    ["a push to another route", "/dashboard", "push", "/browse"],
    ["a push between other pages", "/contact", "push", "/dashboard"],
  ] as const)("leaves storage alone for %s", async (_label, url, navigationType, pathname) => {
    stubWindow({ pathname, scrollY: 900 });
    store.set(KEY, JSON.stringify({ detailPath: GOWN_PATH, search: "", scrollY: 500 }));
    const { trackBrowseReturn } = await load();

    trackBrowseReturn(url, navigationType);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(saved()).toEqual({ detailPath: GOWN_PATH, search: "", scrollY: 500 });
  });

  it.each([
    ["the home page", "/"],
    ["the dashboard", "/dashboard"],
    ["another gown", "/browse/22222222-2222-4222-8222-222222222222"],
  ])("forgets the saved position when a gown is opened from %s", async (_label, pathname) => {
    stubWindow({ pathname, scrollY: 900 });
    store.set(KEY, JSON.stringify({ detailPath: GOWN_PATH, search: "", scrollY: 500 }));
    const { readBrowseReturnPosition, trackBrowseReturn } = await load();

    trackBrowseReturn(GOWN_PATH, "push");

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(readBrowseReturnPosition()).toBeNull();
  });

  it("removes the older position before writing, so a failed write leaves none behind", async () => {
    stubWindow({ scrollY: 2000 });
    store.set(KEY, JSON.stringify({ detailPath: GOWN_PATH, search: "", scrollY: 500 }));
    storage.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const { readBrowseReturnPosition, trackBrowseReturn } = await load();

    expect(() => trackBrowseReturn(GOWN_PATH, "push")).not.toThrow();

    expect(storage.removeItem.mock.invocationCallOrder[0]).toBeLessThan(
      storage.setItem.mock.invocationCallOrder[0],
    );
    expect(readBrowseReturnPosition()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable storage without throwing", async () => {
    stubWindow({ scrollY: 2000 });
    storage.removeItem.mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const { trackBrowseReturn } = await load();

    expect(() => trackBrowseReturn(GOWN_PATH, "push")).not.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(["push", "replace"] as const)("clears a pending restore on a %s", async (type) => {
    stubWindow({ pathname: "/dashboard" });
    const { setPendingBrowseRestore, takePendingBrowseRestore, trackBrowseReturn } = await load();
    setPendingBrowseRestore({ href: "/browse", scrollY: 800, isFreshOnly: false });

    trackBrowseReturn("/contact", type);

    expect(takePendingBrowseRestore("/browse", true)).toBeNull();
  });

  it("keeps a pending restore through a traversal", async () => {
    stubWindow({ pathname: GOWN_PATH });
    const { setPendingBrowseRestore, takePendingBrowseRestore, trackBrowseReturn } = await load();
    setPendingBrowseRestore({ href: "/browse", scrollY: 800, isFreshOnly: true });

    trackBrowseReturn("/browse", "traverse");

    expect(takePendingBrowseRestore("/browse", true)).toBe(800);
  });
});

describe("readBrowseReturnPosition", () => {
  it("returns the saved position", async () => {
    stubWindow();
    store.set(KEY, JSON.stringify({ detailPath: GOWN_PATH, search: "?page=2", scrollY: 0 }));
    const { readBrowseReturnPosition } = await load();

    expect(readBrowseReturnPosition()).toEqual({
      detailPath: GOWN_PATH,
      search: "?page=2",
      scrollY: 0,
    });
  });

  it("returns null when nothing is saved", async () => {
    stubWindow();
    const { readBrowseReturnPosition } = await load();

    expect(readBrowseReturnPosition()).toBeNull();
  });

  it.each([
    ["a string", JSON.stringify("nope")],
    ["null", "null"],
    ["a missing gown path", JSON.stringify({ search: "", scrollY: 10 })],
    ["a missing query", JSON.stringify({ detailPath: GOWN_PATH, scrollY: 10 })],
    ["a missing offset", JSON.stringify({ detailPath: GOWN_PATH, search: "" })],
    ["a non-string gown path", JSON.stringify({ detailPath: 5, search: "", scrollY: 10 })],
    ["a non-string query", JSON.stringify({ detailPath: GOWN_PATH, search: null, scrollY: 10 })],
    ["a text offset", JSON.stringify({ detailPath: GOWN_PATH, search: "", scrollY: "10" })],
    ["a negative offset", JSON.stringify({ detailPath: GOWN_PATH, search: "", scrollY: -1 })],
    ["a non-finite offset", '{"detailPath":"/browse/a","search":"","scrollY":1e999}'],
  ])("rejects %s", async (_label, raw) => {
    stubWindow();
    store.set(KEY, raw);
    const { readBrowseReturnPosition } = await load();

    expect(readBrowseReturnPosition()).toBeNull();
  });

  it("returns null for unparseable JSON, with a warning", async () => {
    stubWindow();
    store.set(KEY, "{not json");
    const { readBrowseReturnPosition } = await load();

    expect(readBrowseReturnPosition()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns null when storage cannot be read", async () => {
    stubWindow();
    storage.getItem.mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const { readBrowseReturnPosition } = await load();

    expect(readBrowseReturnPosition()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getPreviousEntryUrl", () => {
  const entries = (...urls: (string | null)[]) => (): Entry[] => urls.map((url) => ({ url }));

  it("returns the entry directly behind the current one", async () => {
    stubWindow({
      navigation: {
        currentEntry: { index: 2 },
        entries: entries(
          "http://localhost:3000/",
          "http://localhost:3000/browse?category=bridal",
          `http://localhost:3000${GOWN_PATH}`,
          "http://localhost:3000/contact",
        ),
      },
    });
    const { getPreviousEntryUrl } = await load();

    const previous = getPreviousEntryUrl();

    expect(previous?.pathname).toBe("/browse");
    expect(previous?.search).toBe("?category=bridal");
  });

  it("returns null without the Navigation API", async () => {
    stubWindow();
    const { getPreviousEntryUrl } = await load();

    expect(getPreviousEntryUrl()).toBeNull();
  });

  it.each([
    ["this is the first entry", { currentEntry: { index: 0 }, entries: entries("http://localhost:3000/browse") }],
    ["there is no current entry", { currentEntry: null, entries: entries("http://localhost:3000/browse") }],
    ["the current entry is detached", { currentEntry: { index: -1 }, entries: entries() }],
    ["the previous entry hides its URL", { currentEntry: { index: 1 }, entries: entries(null, "http://localhost:3000/x") }],
    ["the previous entry is missing", { currentEntry: { index: 3 }, entries: entries("http://localhost:3000/") }],
  ])("returns null when %s", async (_label, navigation) => {
    stubWindow({ navigation });
    const { getPreviousEntryUrl } = await load();

    expect(getPreviousEntryUrl()).toBeNull();
  });
});

describe("takePendingBrowseRestore", () => {
  it("returns null when nothing is pending", async () => {
    const { takePendingBrowseRestore } = await load();

    expect(takePendingBrowseRestore("/browse", true)).toBeNull();
  });

  it("hands the position over once", async () => {
    const { setPendingBrowseRestore, takePendingBrowseRestore } = await load();
    setPendingBrowseRestore({ href: "/browse?page=2", scrollY: 1200, isFreshOnly: false });

    expect(takePendingBrowseRestore("/browse?page=2", false)).toBe(1200);
    expect(takePendingBrowseRestore("/browse?page=2", false)).toBeNull();
  });

  it("drops a position meant for another list", async () => {
    const { setPendingBrowseRestore, takePendingBrowseRestore } = await load();
    setPendingBrowseRestore({ href: "/browse?page=2", scrollY: 1200, isFreshOnly: false });

    expect(takePendingBrowseRestore("/browse", true)).toBeNull();
    expect(takePendingBrowseRestore("/browse?page=2", true)).toBeNull();
  });

  it("gives a fresh-only position to a freshly mounted list", async () => {
    const { setPendingBrowseRestore, takePendingBrowseRestore } = await load();
    setPendingBrowseRestore({ href: "/browse", scrollY: 640, isFreshOnly: true });

    expect(takePendingBrowseRestore("/browse", true)).toBe(640);
  });

  it("withholds a fresh-only position from a list the router kept alive, and drops it", async () => {
    const { setPendingBrowseRestore, takePendingBrowseRestore } = await load();
    setPendingBrowseRestore({ href: "/browse", scrollY: 640, isFreshOnly: true });

    expect(takePendingBrowseRestore("/browse", false)).toBeNull();
    expect(takePendingBrowseRestore("/browse", true)).toBeNull();
  });

  it("keeps only the latest pending position", async () => {
    const { setPendingBrowseRestore, takePendingBrowseRestore } = await load();
    setPendingBrowseRestore({ href: "/browse", scrollY: 100, isFreshOnly: false });
    setPendingBrowseRestore({ href: "/browse", scrollY: 200, isFreshOnly: false });

    expect(takePendingBrowseRestore("/browse", false)).toBe(200);
  });
});
