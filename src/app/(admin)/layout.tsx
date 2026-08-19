import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";

import { isAdmin } from "@/lib/admin/is-admin";
import { getCurrentUser } from "@/lib/queries/auth";
import { createClient } from "@/lib/supabase/server";

import { isAdminDemoMode } from "./admin-demo";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import AdminLoading from "./loading";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    template: "%s | JGowns Admin",
    default: "JGowns Admin",
  },
  robots: { index: false, follow: false },
};

type AdminLayoutProps = {
  children: ReactNode;
};

/**
 * Two tiers, because the chrome and the boundary have different costs. The
 * shell gates on `getCurrentUser` (local JWT verify) so the sidebar paints
 * immediately instead of waiting on an Auth-server round-trip, and a non-admin
 * still gets the bare 404 with no chrome. The authoritative `getUser()` check
 * sits in its own boundary around the content, where a skeleton belongs.
 * Cookies are dynamic under Cache Components, so both live in async children
 * inside <Suspense> (AGENTS §9).
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

type AdminShellProps = {
  children: ReactNode;
};

async function AdminShell({ children }: AdminShellProps) {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col bg-(--bg-cream) xl:flex-row">
      <AdminTopBar adminEmail={user.email} />
      <AdminSidebar adminEmail={user.email} />
      <main
        id="main-content"
        className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        {/* TEMPORARY, pre-production. Demo mode is set on /admin but applies to
            every page, so it has to announce itself away from that toggle.
            See ADMIN_DEMO_COOKIE for the removal checklist. */}
        {(await isAdminDemoMode()) && (
          <p className="mb-5 flex items-center gap-2 rounded-full border border-[#cbab84] bg-[rgba(179,133,76,0.14)] px-4 py-2 text-xs font-semibold text-[#875f2f]">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            Showing demo data. Turn it off on the Overview page.
          </p>
        )}
        <Suspense fallback={<AdminLoading />}>
          <AdminAuthBoundary>{children}</AdminAuthBoundary>
        </Suspense>
      </main>
    </div>
  );
}

type AdminAuthBoundaryProps = {
  children: ReactNode;
};

async function AdminAuthBoundary({ children }: AdminAuthBoundaryProps) {
  // Security boundary: getUser() (not getClaims) — matches proxy + AGENTS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user)) {
    notFound();
  }

  return <>{children}</>;
}

function AdminShellSkeleton() {
  return (
    <div className="flex min-h-svh flex-col bg-(--bg-cream) xl:flex-row">
      <div className="h-16 w-full shrink-0 animate-pulse bg-[#eadfce]/70 xl:hidden" />
      <aside className="hidden shrink-0 animate-pulse bg-[#eadfce]/70 xl:block xl:h-svh xl:w-60 xl:self-start" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <AdminLoading />
      </div>
    </div>
  );
}
