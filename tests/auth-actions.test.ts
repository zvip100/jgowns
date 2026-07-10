import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockRedirect,
  mockHeaders,
  mockRevalidatePath,
  mockGetUser,
  mockSignInWithPassword,
  mockSignUp,
  mockSignInWithOAuth,
  mockSignOut,
  mockResetPasswordForEmail,
  mockUpdateUser,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockHeaders: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockSignOut: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/headers", () => ({ headers: mockHeaders }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import {
  getAuthClient,
  signIn,
  signUp,
  signInWithGoogle,
  signOut,
  requestPasswordReset,
  updatePassword,
} from "@/lib/actions/auth";

const SUCCESS_MESSAGE = "Check your email to confirm your account!";
const ORIGIN = "https://jgowns.test";

function fakeSupabase() {
  return {
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
    },
  };
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockSignInWithPassword.mockReset();
  mockSignUp.mockReset();
  mockSignInWithOAuth.mockReset();
  mockSignOut.mockReset();
  mockResetPasswordForEmail.mockReset();
  mockUpdateUser.mockReset();
  mockRevalidatePath.mockReset();
  mockRedirect.mockReset().mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mockHeaders.mockReset().mockResolvedValue(new Headers({ origin: ORIGIN }));
  mockCreateClient.mockReset().mockResolvedValue(fakeSupabase());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAuthClient", () => {
  it("returns ok with the user when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const result = await getAuthClient();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user).toEqual({ id: "u1" });
  });

  it("returns not-authenticated when there is no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAuthClient();

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
  });

  it("returns not-authenticated when getUser errors", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "boom" },
    });

    const result = await getAuthClient();

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
  });
});

describe("signIn", () => {
  it("redirects to /dashboard on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn({ email: "a@b.com", password: "secret6" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secret6",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to a safe next path on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn({ email: "a@b.com", password: "secret6", next: "/dashboard/new" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/new");
  });

  it("ignores an unsafe next and falls back to /dashboard", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn({ email: "a@b.com", password: "secret6", next: "https://evil.com" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns the Supabase error and does not redirect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await signIn({ email: "a@b.com", password: "secret6" });

    expect(result).toEqual({ error: "Invalid login credentials" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before calling Supabase", async () => {
    const result = await signIn({ email: "not-an-email", password: "secret6" });

    expect(result).toEqual({ error: "Please enter a valid email and password." });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an empty password before calling Supabase", async () => {
    const result = await signIn({ email: "a@b.com", password: "" });

    expect(result).toHaveProperty("error");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  it("succeeds without a phone and passes no metadata", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    const result = await signUp({ email: "a@b.com", password: "secret6" });

    expect(result).toEqual({ success: true, message: SUCCESS_MESSAGE });
    const arg = mockSignUp.mock.calls[0][0];
    expect(arg.email).toBe("a@b.com");
    expect(arg.options.data).toBeUndefined();
    expect(arg.options.emailRedirectTo).toBe(
      `${ORIGIN}/api/auth/callback?next=%2Fdashboard`,
    );
  });

  it("threads a safe next into the email confirmation redirect", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    await signUp({
      email: "a@b.com",
      password: "secret6",
      next: "/dashboard/new",
    });

    expect(mockSignUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${ORIGIN}/api/auth/callback?next=%2Fdashboard%2Fnew`,
    );
  });

  it("stores a normalized digits-only phone in user metadata", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    const result = await signUp({
      email: "a@b.com",
      password: "secret6",
      phone: "(555) 123-4567",
    });

    expect(result).toEqual({ success: true, message: SUCCESS_MESSAGE });
    expect(mockSignUp.mock.calls[0][0].options.data).toEqual({
      phone: "5551234567",
    });
  });

  it("treats an empty phone string as no phone", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    await signUp({ email: "a@b.com", password: "secret6", phone: "" });

    expect(mockSignUp.mock.calls[0][0].options.data).toBeUndefined();
  });

  it("rejects a too-short phone before calling Supabase", async () => {
    const result = await signUp({
      email: "a@b.com",
      password: "secret6",
      phone: "12",
    });

    expect(result).toEqual({
      error: "Leave phone blank, or enter a valid phone number.",
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects a phone containing letters instead of stripping them", async () => {
    const result = await signUp({
      email: "a@b.com",
      password: "secret6",
      phone: "555-CALL-NOW",
    });

    expect(result).toEqual({
      error: "Leave phone blank, or enter a valid phone number.",
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("accepts a formatted phone and normalizes it to digits", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    await signUp({
      email: "a@b.com",
      password: "secret6",
      phone: "+1 (555) 123-4567",
    });

    expect(mockSignUp.mock.calls[0][0].options.data).toEqual({
      phone: "15551234567",
    });
  });

  it("rejects a too-short password before calling Supabase", async () => {
    const result = await signUp({ email: "a@b.com", password: "123" });

    expect(result).toEqual({ error: "Password must be at least 6 characters." });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before calling Supabase", async () => {
    const result = await signUp({ email: "bad", password: "secret6" });

    expect(result).toEqual({ error: "Please enter a valid email address." });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("surfaces the Supabase error message", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: "User already registered" },
    });

    const result = await signUp({ email: "a@b.com", password: "secret6" });

    expect(result).toEqual({ error: "User already registered" });
  });
});

describe("signInWithGoogle", () => {
  it("redirects to the provider URL on success", async () => {
    const url = "https://accounts.google.com/o/oauth2/auth?x=1";
    mockSignInWithOAuth.mockResolvedValue({ data: { url }, error: null });

    await expect(
      signInWithGoogle({ error: null }, new FormData()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${ORIGIN}/api/auth/callback?next=%2Fdashboard` },
    });
    expect(mockRedirect).toHaveBeenCalledWith(url);
  });

  it("threads a safe next from the form into the callback redirect", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth" },
      error: null,
    });

    const formData = new FormData();
    formData.set("next", "/dashboard/new");

    await expect(
      signInWithGoogle({ error: null }, formData),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${ORIGIN}/api/auth/callback?next=%2Fdashboard%2Fnew`,
      },
    });
  });

  it("returns the Supabase error and does not redirect", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "provider disabled" },
    });

    const result = await signInWithGoogle({ error: null }, new FormData());

    expect(result).toEqual({ error: "provider disabled" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns a generic error when no provider URL is returned", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    const result = await signInWithGoogle({ error: null }, new FormData());

    expect(result).toEqual({
      error: "Could not start Google sign-in. Please try again.",
    });
  });
});

describe("requestPasswordReset", () => {
  it("sends the reset email with the callback redirect to /reset-password", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const result = await requestPasswordReset({ email: "a@b.com" });

    expect(result).toEqual({
      success: true,
      message: "Check your email for a link to reset your password.",
    });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: `${ORIGIN}/api/auth/callback?next=%2Freset-password`,
    });
  });

  it("nests a safe next under the reset-password callback target", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    await requestPasswordReset({ email: "a@b.com", next: "/dashboard/new" });

    const nestedNext = encodeURIComponent(
      `/reset-password?next=${encodeURIComponent("/dashboard/new")}`,
    );
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: `${ORIGIN}/api/auth/callback?next=${nestedNext}`,
    });
  });

  it("drops an unsafe next and pins the callback to /reset-password", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    await requestPasswordReset({ email: "a@b.com", next: "https://evil.com" });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: `${ORIGIN}/api/auth/callback?next=%2Freset-password`,
    });
  });

  it("rejects an invalid email before calling Supabase", async () => {
    const result = await requestPasswordReset({ email: "not-an-email" });

    expect(result).toEqual({ error: "Please enter a valid email address." });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("surfaces the Supabase error message", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });

    const result = await requestPasswordReset({ email: "a@b.com" });

    expect(result).toEqual({ error: "Email rate limit exceeded" });
  });
});

describe("updatePassword", () => {
  it("updates the password and redirects to the dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    await expect(updatePassword({ password: "secret6" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "secret6" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to a safe next path on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    await expect(
      updatePassword({ password: "secret6", next: "/dashboard/new" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "secret6" });
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/new");
  });

  it("ignores an unsafe next and falls back to /dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    await expect(
      updatePassword({ password: "secret6", next: "https://evil.com" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects a too-short password before calling Supabase", async () => {
    const result = await updatePassword({ password: "123" });

    expect(result).toEqual({ error: "Password must be at least 6 characters." });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("returns an expired-link error when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await updatePassword({ password: "secret6" });

    expect(result).toEqual({
      error: "Your reset link is invalid or expired. Request a new one.",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("surfaces the Supabase error and does not redirect", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpdateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password." },
    });

    const result = await updatePassword({ password: "secret6" });

    expect(result).toEqual({
      error: "New password should be different from the old password.",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and redirects home", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});
