import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsert, mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const mockCreateClient = vi.fn(async () => ({ from: mockFrom }));
  return { mockInsert, mockFrom, mockCreateClient };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { submitContactMessage } from "@/lib/actions/contact";

function makeFormData(
  fields: Partial<{ email: string; message: string; company: string }>,
): FormData {
  const fd = new FormData();
  if (fields.email !== undefined) fd.set("email", fields.email);
  if (fields.message !== undefined) fd.set("message", fields.message);
  if (fields.company !== undefined) fd.set("company", fields.company);
  return fd;
}

const VALID_MESSAGE = "I have a question about listing my gown.";

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitContactMessage", () => {
  it("inserts a valid submission and returns success", async () => {
    const result = await submitContactMessage(
      makeFormData({ email: "buyer@example.com", message: VALID_MESSAGE }),
    );

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith("contact_messages");
    expect(mockInsert).toHaveBeenCalledWith({
      email: "buyer@example.com",
      message: VALID_MESSAGE,
    });
  });

  it("trims the message before storing it", async () => {
    await submitContactMessage(
      makeFormData({
        email: "buyer@example.com",
        message: `   ${VALID_MESSAGE}   `,
      }),
    );

    expect(mockInsert).toHaveBeenCalledWith({
      email: "buyer@example.com",
      message: VALID_MESSAGE,
    });
  });

  it("rejects an invalid email without inserting", async () => {
    const result = await submitContactMessage(
      makeFormData({ email: "not-an-email", message: VALID_MESSAGE }),
    );

    expect(result).toEqual({
      success: false,
      error: "Enter a valid email address.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a message shorter than 10 characters", async () => {
    const result = await submitContactMessage(
      makeFormData({ email: "buyer@example.com", message: "too short" }),
    );

    expect(result).toEqual({
      success: false,
      error: "Your message must be at least 10 characters.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a message longer than 2,000 characters", async () => {
    const result = await submitContactMessage(
      makeFormData({ email: "buyer@example.com", message: "a".repeat(2001) }),
    );

    expect(result).toEqual({
      success: false,
      error: "Your message must be 2,000 characters or less.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("short-circuits to success when the honeypot is filled, without inserting", async () => {
    const result = await submitContactMessage(
      makeFormData({
        email: "buyer@example.com",
        message: VALID_MESSAGE,
        company: "spam-bot",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns a sanitized error when the insert fails", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "db exploded" } });

    const result = await submitContactMessage(
      makeFormData({ email: "buyer@example.com", message: VALID_MESSAGE }),
    );

    expect(result).toEqual({
      success: false,
      error: "We couldn't send your message. Please try again in a moment.",
    });
  });
});
