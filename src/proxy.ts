import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/admin/is-admin";

/**
 * Supabase mutates cookies while verifying (a rotated token, or clearing a stale
 * session after a failed refresh). Any response other than `supabaseResponse`
 * drops them silently unless they are copied across.
 */
function withSessionCookies(
  response: NextResponse,
  supabaseResponse: NextResponse,
): NextResponse {
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

function redirectToLogin(
  request: NextRequest,
  supabaseResponse: NextResponse,
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return withSessionCookies(NextResponse.redirect(loginUrl), supabaseResponse);
}

/**
 * Serves the 404 route's own response for an `/admin` URL without changing the
 * address bar. Rewriting decides the route before Next resolves one, which is
 * the only point where the status code and the `<title>` are still open: a
 * `notFound()` thrown later in the tree inherits the admin page's title and a
 * 200. Presentation only — the authoritative claim check stays in the layout.
 */
function rewriteToNotFound(
  request: NextRequest,
  supabaseResponse: NextResponse,
): NextResponse {
  return withSessionCookies(
    NextResponse.rewrite(new URL("/_not-found", request.url)),
    supabaseResponse,
  );
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect to login, preserving the intended destination.
  // Copy Supabase's cookie mutations (e.g. clearing a stale session after a failed
  // refresh) onto the redirect, or they are silently dropped.
  if (pathname.startsWith("/dashboard") && !user) {
    return redirectToLogin(request, supabaseResponse);
  }

  // /admin is never redirected to login: a login prompt confirms an admin surface
  // exists, which is what the opaque 404 is for, and admins land on /admin from
  // postAuthPath anyway. Signed-out visitors and authenticated non-admins get the
  // same 404 a nonexistent URL gets, status and title included. The claim comes
  // from the getUser() call above, so it is server-fresh rather than a stale JWT.
  if (pathname.startsWith("/admin") && !isAdmin(user)) {
    return rewriteToNotFound(request, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
