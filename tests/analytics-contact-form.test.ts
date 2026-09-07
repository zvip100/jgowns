import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  hookState,
  mockCaptureEvent,
  mockSubmitContactMessage,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  hookState: { stateCallCount: 0 },
  mockCaptureEvent: vi.fn(),
  mockSubmitContactMessage: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <State>(initial: State): [State, (next: unknown) => void] => {
      hookState.stateCallCount++;
      return [initial, () => {}];
    },
  };
});

vi.mock("@/lib/actions/contact", () => ({
  submitContactMessage: mockSubmitContactMessage,
}));
vi.mock("@/lib/analytics/client", () => ({ captureEvent: mockCaptureEvent }));
vi.mock("@/lib/toast", () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}));

import ContactForm from "@/app/(main)/contact/ContactForm";

beforeEach(() => {
  mockCaptureEvent.mockReset();
  mockSubmitContactMessage.mockReset();
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
  vi.stubGlobal(
    "FormData",
    class {
      private readonly values = new Map<string, string>();
      constructor(form?: { __seed?: Record<string, string> }) {
        for (const [k, v] of Object.entries(form?.__seed ?? {})) {
          this.values.set(k, v);
        }
      }
      get(key: string) {
        return this.values.get(key) ?? null;
      }
      set(key: string, value: string) {
        this.values.set(key, value);
      }
    },
  );
});

describe("contact_form_submitted", () => {
  it("reports a successful submission", async () => {
    mockSubmitContactMessage.mockResolvedValue({ success: true });

    await submitWithSeed({ email: "a@b.com", message: "A long enough message." });

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith("contact_form_submitted", {
      succeeded: true,
      error_kind: null,
    });
  });

  it("reports a server failure with error_kind", async () => {
    mockSubmitContactMessage.mockResolvedValue({
      success: false,
      error: "We couldn't send your message.",
    });

    await submitWithSeed({ email: "a@b.com", message: "A long enough message." });

    expect(mockCaptureEvent).toHaveBeenCalledWith("contact_form_submitted", {
      succeeded: false,
      error_kind: "server",
    });
  });

  it("reports a thrown network failure with error_kind", async () => {
    mockSubmitContactMessage.mockRejectedValue(new Error("offline"));

    await submitWithSeed({ email: "a@b.com", message: "A long enough message." });

    expect(mockCaptureEvent).toHaveBeenCalledWith("contact_form_submitted", {
      succeeded: false,
      error_kind: "network",
    });
  });

  // Inline validation is not a submission; nothing reached the server.
  it("captures nothing when validation rejects the form", async () => {
    await submitWithSeed({ email: "not-an-email", message: "" });

    expect(mockSubmitContactMessage).not.toHaveBeenCalled();
    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});

/**
 * Drives the real submit handler off the rendered element, so the assertion
 * covers the wiring rather than a copy of it.
 */
async function submitWithSeed(fields: { email: string; message: string }) {
  const element = (ContactForm as unknown as () => {
    props: { onSubmit: (event: unknown) => Promise<void> };
  })();

  await element.props.onSubmit({
    preventDefault: () => {},
    currentTarget: { __seed: fields, reset: () => {} },
  });
}
