import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_POST_AUTH_PATH, safePostAuthPath } from "@/lib/auth-redirect";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function loginErrorUrl(next: string): string {
  const url = new URL("/login", SITE_URL);
  url.searchParams.set("error", "auth");
  if (next !== DEFAULT_POST_AUTH_PATH) url.searchParams.set("next", next);
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safePostAuthPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error.message);
    return NextResponse.redirect(loginErrorUrl(next));
  }

  return NextResponse.redirect(`${SITE_URL}${next}`);
}
