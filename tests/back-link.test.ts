import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expand, findAll, textOf } from "./support/react-hook-harness";

import type { ReactElement, ReactNode } from "react";

type Props = Record<string, unknown>;
type NavigateHandler = (event: { preventDefault: () => void }) => void;

const GOWN_PATH = "/browse/11111111-1111-4111-8111-111111111111";

const { mockBack, mockGetPreviousEntryUrl, mockPush, mockRead, mockSetPending, routerState } =
  vi.hoisted(() => ({
    mockBack: vi.fn(),
    mockGetPreviousEntryUrl: vi.fn(),
    mockPush: vi.fn(),
    mockRead: vi.fn(),
    mockSetPending: vi.fn(),
    routerState: { search: "" },
  }));

vi.mock("next/link", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { default: (props: Props) => actual.createElement("a", props) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useSearchParams: () => new URLSearchParams(routerState.search),
}));

vi.mock("@/lib/browse-return", () => ({
  getPreviousEntryUrl: mockGetPreviousEntryUrl,
  readBrowseReturnPosition: mockRead,
  setPendingBrowseRestore: mockSetPending,
}));

import { BackLink } from "@/app/(main)/browse/[id]/BackLink";

function anchorOf(node: ReactNode): ReactElement<Props> {
  const anchors = findAll(React, expand(React, node), (_props, type) => type === "a");
  expect(anchors).toHaveLength(1);
  return anchors[0];
}

function boundary(): ReactElement<{ fallback: ReactNode; children: ReactNode }> {
  return BackLink() as ReactElement<{ fallback: ReactNode; children: ReactNode }>;
}

/** The link as rendered once the URL is readable. */
function renderLink(search: string): ReactElement<Props> {
  routerState.search = search;
  return anchorOf(boundary().props.children);
}

/** Clicks "All gowns" on a gown page and reports whether the link's own navigation was cancelled. */
function click(search = ""): { prevented: boolean; href: string } {
  const link = renderLink(search);
  const preventDefault = vi.fn();
  (link.props.onNavigate as NavigateHandler)({ preventDefault });
  return { prevented: preventDefault.mock.calls.length > 0, href: link.props.href as string };
}

const previousEntry = (path: string): URL => new URL(`http://localhost:3000${path}`);

beforeEach(() => {
  vi.stubGlobal("window", { location: { pathname: GOWN_PATH } });
  mockBack.mockReset();
  mockPush.mockReset();
  mockSetPending.mockReset();
  mockRead.mockReset().mockReturnValue(null);
  mockGetPreviousEntryUrl.mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BackLink", () => {
  it("renders a plain link to the list while the URL is not readable yet", () => {
    const link = anchorOf(boundary().props.fallback);

    expect(link.props.href).toBe("/browse");
    expect(link.props.onNavigate).toBeUndefined();
    expect(textOf(React, link)).toBe("All gowns");
  });

  it("points at the list the gown was opened from", () => {
    const link = renderLink("back=category%3Dbridal%26page%3D2");

    expect(link.props.href).toBe("/browse?category=bridal&page=2");
    expect(link.props.prefetch).toBe(true);
    expect(textOf(React, link)).toBe("All gowns");
  });

  it("leaves the dashboard variant as an ordinary link", () => {
    const link = renderLink("from=dash&back=category%3Dbridal");

    expect(link.props.href).toBe("/dashboard");
    expect(link.props.onNavigate).toBeUndefined();
    expect(textOf(React, link)).toBe("Back to dashboard");
  });
});

describe("All gowns click", () => {
  it("goes back in history when the list is the previous entry", () => {
    mockGetPreviousEntryUrl.mockReturnValue(previousEntry("/browse"));

    const { prevented } = click();

    expect(prevented).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSetPending).not.toHaveBeenCalled();
  });

  it("queues the saved position before going back, for a list that has to mount fresh", () => {
    mockGetPreviousEntryUrl.mockReturnValue(previousEntry("/browse?category=bridal&page=2"));
    mockRead.mockReturnValue({
      detailPath: GOWN_PATH,
      search: "?category=bridal&page=2",
      scrollY: 2330,
    });

    const { prevented, href } = click("back=category%3Dbridal%26page%3D2");

    expect(prevented).toBe(true);
    expect(mockSetPending).toHaveBeenCalledWith({ href, scrollY: 2330, isFreshOnly: true });
    expect(mockSetPending.mock.invocationCallOrder[0]).toBeLessThan(
      mockBack.mock.invocationCallOrder[0],
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("treats an equivalent, differently written list URL as the same list", () => {
    mockGetPreviousEntryUrl.mockReturnValue(previousEntry("/browse?page=1&utm_source=mail"));

    click();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a list with other filters", "/browse?category=bridal"],
    ["another page of the list", "/browse?page=2"],
    ["another gown", "/browse/22222222-2222-4222-8222-222222222222"],
    ["another route", "/dashboard"],
  ])("does not go back when the previous entry is %s", (_label, path) => {
    mockGetPreviousEntryUrl.mockReturnValue(previousEntry(path));

    const { prevented } = click();

    expect(mockBack).not.toHaveBeenCalled();
    expect(prevented).toBe(false);
  });

  it("pushes without scrolling to the top, then queues the saved position", () => {
    mockRead.mockReturnValue({ detailPath: GOWN_PATH, search: "?page=2", scrollY: 1200 });

    const { prevented, href } = click("back=page%3D2");

    expect(prevented).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(href, { scroll: false });
    expect(mockSetPending).toHaveBeenCalledWith({ href, scrollY: 1200, isFreshOnly: false });
    expect(mockPush.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetPending.mock.invocationCallOrder[0],
    );
  });

  it("restores a position saved at the very top", () => {
    mockRead.mockReturnValue({ detailPath: GOWN_PATH, search: "", scrollY: 0 });

    click();

    expect(mockSetPending).toHaveBeenCalledWith({ href: "/browse", scrollY: 0, isFreshOnly: false });
  });

  it.each([
    ["another gown", { detailPath: "/browse/other", search: "", scrollY: 900 }],
    ["another list", { detailPath: GOWN_PATH, search: "?category=bridal", scrollY: 900 }],
  ])("ignores a position saved for %s", (_label, position) => {
    mockRead.mockReturnValue(position);

    const { prevented } = click();

    expect(prevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSetPending).not.toHaveBeenCalled();
  });

  it("goes back without a restore when the saved position belongs to another gown", () => {
    mockGetPreviousEntryUrl.mockReturnValue(previousEntry("/browse"));
    mockRead.mockReturnValue({ detailPath: "/browse/other", search: "", scrollY: 900 });

    click();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockSetPending).not.toHaveBeenCalled();
  });

  it("stays an ordinary link to the top when there is nothing to return to", () => {
    const { prevented } = click("back=category%3Dbridal");

    expect(prevented).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSetPending).not.toHaveBeenCalled();
  });
});
