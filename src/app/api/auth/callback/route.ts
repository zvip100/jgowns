import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_POST_AUTH_PATH, safePostAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

function loginErrorUrl(origin: string, next: string): string {
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth");
  if (next !== DEFAULT_POST_AUTH_PATH) url.searchParams.set("next", next);
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safePostAuthPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(origin, next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error.message);
    return NextResponse.redirect(loginErrorUrl(origin, next));
  }

  return NextResponse.redirect(`${origin}${next}`);
}
