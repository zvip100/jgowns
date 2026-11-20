import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginRender, harness, resetHarness, runEffects } from "./support/react-hook-harness";

vi.mock("react", async () =>
  (await import("./support/react-hook-harness")).mockReact(await vi.importActual("react")),
);

import BrowseScrollRestorer from "@/app/(main)/browse/BrowseScrollRestorer";
import { setPendingBrowseRestore, takePendingBrowseRestore } from "@/lib/browse-return";

const scrollTo = vi.fn<(x: number, y: number) => void>();

/** One commit of the restorer: render, then its layout effect. */
function commit(href: string): null {
  beginRender();
  const output = BrowseScrollRestorer({ href });
  runEffects();
  return output;
}

function stubScroll(scrollY: number): void {
  vi.stubGlobal("window", { scrollY, scrollTo });
}

beforeEach(() => {
  resetHarness();
  scrollTo.mockReset();
  takePendingBrowseRestore("", true);
  stubScroll(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrowseScrollRestorer", () => {
  it("renders nothing and leaves the scroll alone when nothing is pending", () => {
    expect(commit("/browse")).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("restores in the layout phase, before the list is painted at the wrong place", () => {
    commit("/browse");

    expect(harness.effects).toHaveLength(1);
    expect(harness.effects[0].isLayout).toBe(true);
    expect(harness.effects[0].deps).toEqual(["/browse"]);
  });

  it("scrolls a freshly mounted list to the pending position", () => {
    setPendingBrowseRestore({ href: "/browse?page=2", scrollY: 2330, isFreshOnly: true });

    commit("/browse?page=2");

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 2330);
  });

  it("consumes the position, so a later commit does not scroll again", () => {
    setPendingBrowseRestore({ href: "/browse", scrollY: 900, isFreshOnly: false });

    commit("/browse");
    commit("/browse");

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("skips the scroll when the list is already there", () => {
    stubScroll(2330.5);
    setPendingBrowseRestore({ href: "/browse", scrollY: 2330, isFreshOnly: false });

    commit("/browse");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("ignores a position meant for another list", () => {
    setPendingBrowseRestore({ href: "/browse?category=bridal", scrollY: 900, isFreshOnly: false });

    commit("/browse");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("counts only its first commit as fresh", () => {
    commit("/browse");
    setPendingBrowseRestore({ href: "/browse", scrollY: 900, isFreshOnly: true });

    commit("/browse");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("still applies a push restore to a list that was already mounted", () => {
    commit("/browse");
    setPendingBrowseRestore({ href: "/browse", scrollY: 900, isFreshOnly: false });

    commit("/browse");

    expect(scrollTo).toHaveBeenCalledWith(0, 900);
  });
});
