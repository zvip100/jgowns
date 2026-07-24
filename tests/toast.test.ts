import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSuccess, mockError, mockInfo, mockWarning, mockPromise } =
  vi.hoisted(() => ({
    mockSuccess: vi.fn(() => "id-success"),
    mockError: vi.fn(() => "id-error"),
    mockInfo: vi.fn(() => "id-info"),
    mockWarning: vi.fn(() => "id-warning"),
    mockPromise: vi.fn(() => "id-promise"),
  }));

vi.mock("sonner", () => ({
  toast: {
    success: mockSuccess,
    error: mockError,
    info: mockInfo,
    warning: mockWarning,
    promise: mockPromise,
  },
}));

import { toast } from "@/lib/toast";

describe("toast helper", () => {
  beforeEach(() => {
    mockSuccess.mockClear();
    mockError.mockClear();
    mockInfo.mockClear();
    mockWarning.mockClear();
    mockPromise.mockClear();
  });

  it("success forwards message and options to sonner and returns the id", () => {
    const result = toast.success("Saved to wishlist", { description: "Nice" });

    expect(mockSuccess).toHaveBeenCalledWith("Saved to wishlist", {
      description: "Nice",
    });
    expect(result).toBe("id-success");
  });

  it("success forwards a bare message with no options", () => {
    toast.success("Link copied");
    expect(mockSuccess).toHaveBeenCalledWith("Link copied", undefined);
  });

  it("info forwards message and options", () => {
    toast.info("Heads up", { duration: 3000 });
    expect(mockInfo).toHaveBeenCalledWith("Heads up", { duration: 3000 });
  });

  it("warning forwards message and options", () => {
    toast.warning("Careful");
    expect(mockWarning).toHaveBeenCalledWith("Careful", undefined);
  });

  it("error defaults to a 6s duration", () => {
    toast.error("Not synced", {
      description: "This change is saved on this device but did not reach your account.",
    });

    expect(mockError).toHaveBeenCalledWith("Not synced", {
      duration: 6000,
      description:
        "This change is saved on this device but did not reach your account.",
    });
  });

  it("error applies the default duration even with no options", () => {
    toast.error("Couldn't send message");
    expect(mockError).toHaveBeenCalledWith("Couldn't send message", {
      duration: 6000,
    });
  });

  it("error lets a caller-supplied duration win over the default", () => {
    toast.error("Slow one", { duration: 10000 });
    expect(mockError).toHaveBeenCalledWith("Slow one", { duration: 10000 });
  });

  it("error forwards an id so it can replace a live toast in place", () => {
    toast.error("Not synced", { id: "wishlist-add", description: "…" });

    expect(mockError).toHaveBeenCalledWith("Not synced", {
      duration: 6000,
      id: "wishlist-add",
      description: "…",
    });
  });

  it("error forwards an action option through", () => {
    const onClick = vi.fn();
    toast.error("Failed", { action: { label: "Retry", onClick } });

    expect(mockError).toHaveBeenCalledWith("Failed", {
      duration: 6000,
      action: { label: "Retry", onClick },
    });
  });

  it("promise forwards the promise and messages to sonner", () => {
    const input = Promise.resolve("ok");
    const messages = {
      loading: "Saving…",
      success: "Saved",
      error: "Couldn't save",
    };

    const result = toast.promise(input, messages);

    expect(mockPromise).toHaveBeenCalledWith(input, messages);
    expect(result).toBe("id-promise");
  });
});
