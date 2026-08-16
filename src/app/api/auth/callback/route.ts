import { NextResponse, type NextRequest } from "next/server";

import { postAuthPath, safeNextPath } from "@/lib/auth-redirect";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function loginErrorUrl(next: string | null): string {
  const url = new URL("/login", SITE_URL);
  url.searchParams.set("error", "auth");
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(loginErrorUrl(next));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error.message);
    return NextResponse.redirect(loginErrorUrl(next));
  }

  // Recovery links carry next=/reset-password, which postAuthPath passes through
  // untouched; only the default destination is swapped for admins.
  return NextResponse.redirect(`${SITE_URL}${postAuthPath(data.user, next)}`);
}
