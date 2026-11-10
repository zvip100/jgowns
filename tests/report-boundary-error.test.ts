import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }));

vi.mock("react", async () => ({
  ...(await vi.importActual<typeof import("react")>("react")),
  useEffect: (effect: () => void): void => effect(),
}));
vi.mock("@/lib/analytics/client", () => ({ captureClientException: mockCapture }));
vi.mock("@/components/ErrorStateCard", () => ({ default: () => null }));

import RootError from "@/app/error";
import AdminError from "@/app/(admin)/error";
import MainError from "@/app/(main)/error";
import GlobalError from "@/app/global-error";
import { useReportBoundaryError } from "@/hooks/useReportBoundaryError";

beforeEach(() => {
  mockCapture.mockReset();
});

describe("useReportBoundaryError", () => {
  it("reports the error with its scope and digest", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    useReportBoundaryError(error, "errorBoundary.root");

    expect(mockCapture).toHaveBeenCalledWith(error, "errorBoundary.root", {
      digest: "abc123",
    });
  });

  it("reports an error with no digest", () => {
    const error = new Error("boom");

    useReportBoundaryError(error, "errorBoundary.root");

    expect(mockCapture).toHaveBeenCalledWith(error, "errorBoundary.root", {
      digest: undefined,
    });
  });
});

describe("error boundaries", () => {
  it.each([
    ["errorBoundary.root", RootError],
    ["errorBoundary.main", MainError],
    ["errorBoundary.admin", AdminError],
    ["errorBoundary.global", GlobalError],
  ])("%s reports what it caught", (scope, Boundary) => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    Boundary({ error, unstable_retry: () => {} });

    expect(mockCapture).toHaveBeenCalledOnce();
    expect(mockCapture).toHaveBeenCalledWith(error, scope, { digest: "abc123" });
  });
});
