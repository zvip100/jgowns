"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safePostAuthPath } from "@/lib/auth-redirect";
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

const SIGN_UP_SUCCESS_MESSAGE = "Check your email to confirm your account!";

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

export async function getAuthClient(): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: SupabaseServer; user: { id: string } }
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
  redirect("/");
}

export async function signIn(
  input: SignInInput,
): Promise<ServerActionErrorResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(safePostAuthPath(input.next));
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: signUpErrorMessage(parsed.error) };
  }

  const { email, password, phone } = parsed.data;
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const next = safePostAuthPath(input.next);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      data: phone ? { phone } : undefined,
    },
  });

  if (error) {
    console.error("Sign-up failed:", error.message);
    return { error: error.message };
  }

  return { success: true, message: SIGN_UP_SUCCESS_MESSAGE };
}

export async function signInWithGoogle(
  _prevState: GoogleAuthState,
  formData: FormData,
): Promise<GoogleAuthState> {
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const nextValue = formData.get("next");
  const next = safePostAuthPath(
    typeof nextValue === "string" ? nextValue : null,
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
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
