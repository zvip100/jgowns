"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { postAuthPath, safeNextPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";
import { optionalPhoneSchema } from "@/lib/utils";

import type { ServerActionErrorResult } from "@/lib/types";

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type SignInInput = { email: string; password: string; next?: string };
export type SignUpInput = {
  email: string;
  password: string;
  phone?: string;
  next?: string;
};
export type SignUpResult =
  | { success: true; message: string }
  | { error: string };
export type GoogleAuthState = { error: string | null };
export type RequestPasswordResetInput = { email: string; next?: string };
export type RequestPasswordResetResult =
  | { success: true; message: string }
  | { error: string };
export type UpdatePasswordInput = { password: string; next?: string };

const SIGN_UP_SUCCESS_MESSAGE = "Check your email to confirm your account!";
const RESET_EMAIL_SENT_MESSAGE =
  "Check your email for a link to reset your password.";
const RESET_PASSWORD_PATH = "/reset-password";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  phone: optionalPhoneSchema,
});

function signUpErrorMessage(error: z.ZodError): string {
  if (error.issues.some((issue) => issue.path[0] === "phone")) {
    return "Leave phone blank, or enter a valid phone number.";
  }
  if (error.issues.some((issue) => issue.path[0] === "password")) {
    return "Password must be at least 6 characters.";
  }
  return "Please enter a valid email address.";
}

/** Origin of the current request, used to build Supabase redirect URLs. */
async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Supabase redirect target. `next` is omitted entirely when none was requested. */
function authCallbackUrl(origin: string, next: string | null): string {
  const callback = `${origin}/api/auth/callback`;
  return next ? `${callback}?next=${encodeURIComponent(next)}` : callback;
}

export async function getAuthClient(): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: SupabaseServer;
      // app_metadata carries the JWT-signed role, read only via `isAdmin`.
      user: { id: string; app_metadata?: Record<string, unknown> };
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "Not authenticated" };
  return { ok: true, supabase, user };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Sign-out failed:", error.message);

  revalidatePath("/", "layout");
  redirect("/browse");
}

export async function signIn(
  input: SignInInput,
): Promise<ServerActionErrorResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please enter a valid email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(postAuthPath(data.user, input.next));
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: signUpErrorMessage(parsed.error) };
  }

  const { email, password, phone } = parsed.data;
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const next = safeNextPath(input.next);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authCallbackUrl(origin, next),
      data: phone ? { phone } : undefined,
    },
  });

  if (error) {
    console.error("Sign-up failed:", error.message);
    return { error: error.message };
  }

  return { success: true, message: SIGN_UP_SUCCESS_MESSAGE };
}

export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  const parsed = z.email().safeParse(input.email);
  if (!parsed.success) return { error: "Please enter a valid email address." };

  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const safeNext = safeNextPath(input.next);
  const resetPath = safeNext
    ? `${RESET_PASSWORD_PATH}?next=${encodeURIComponent(safeNext)}`
    : RESET_PASSWORD_PATH;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: authCallbackUrl(origin, resetPath),
  });

  if (error) {
    console.error("Password reset request failed:", error.message);
    return { error: error.message };
  }

  return { success: true, message: RESET_EMAIL_SENT_MESSAGE };
}

export async function updatePassword(
  input: UpdatePasswordInput,
): Promise<ServerActionErrorResult> {
  const parsed = z.string().min(6).safeParse(input.password);
  if (!parsed.success) {
    return { error: "Password must be at least 6 characters." };
  }

  const auth = await getAuthClient();
  if (!auth.ok) {
    return { error: "Your reset link is invalid or expired. Request a new one." };
  }

  const { error } = await auth.supabase.auth.updateUser({
    password: parsed.data,
  });
  if (error) {
    console.error("Password update failed:", error.message);
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(postAuthPath(auth.user, input.next));
}

export async function signInWithGoogle(
  _prevState: GoogleAuthState,
  formData: FormData,
): Promise<GoogleAuthState> {
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const nextValue = formData.get("next");
  const next = safeNextPath(typeof nextValue === "string" ? nextValue : null);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(origin, next),
    },
  });

  if (error) {
    console.error("Google sign-in failed:", error.message);
    return { error: error.message };
  }
  if (!data.url) {
    return { error: "Could not start Google sign-in. Please try again." };
  }

  redirect(data.url);
}
