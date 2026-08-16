import Link from "next/link";
import { LogOut, Store, UserRound } from "lucide-react";

import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";

import { AdminNav } from "./AdminNav";

type AdminNavPanelProps = {
  adminEmail: string | null;
};

/**
 * The sidebar's contents, shared verbatim by the persistent rail at xl and the
 * drawer below it. Returns a fragment so each wrapper owns its own chrome.
 */
export function AdminNavPanel({ adminEmail }: AdminNavPanelProps) {
  return (
    <>
      {/* Wordmark and section label stack as one lockup. Side by side they read
          as two unrelated words, because the logo SVG carries trailing space. */}
      <Link
        href="/admin"
        aria-label="Admin overview"
        className="flex w-fit flex-col px-5 py-5"
      >
        <Logo className="h-8 w-auto" />
        <span className="-mt-0.5 text-[0.62rem] font-semibold tracking-[0.18em] text-(--accent-deep) uppercase">
          Admin
        </span>
      </Link>

      <AdminNav />

      <div className="mt-auto flex flex-col gap-2.5 border-t border-(--line) px-5 py-4">
        <Link
          href="/browse"
          className="inline-flex w-fit shrink-0 items-center gap-2 text-xs font-semibold text-(--accent-deep) transition hover:text-(--ink)"
        >
          <Store className="size-3.5" aria-hidden />
          Go to marketplace
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <UserRound
            className="size-4 shrink-0 text-(--accent-deep)"
            aria-hidden
          />
          {adminEmail && (
            <span
              className="truncate text-xs text-(--muted-ink)"
              title={adminEmail}
            >
              {adminEmail}
            </span>
          )}
          <SignOutButton
            ariaLabel="Sign out"
            className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full text-(--muted-ink) transition-colors hover:bg-white/70 hover:text-(--ink)"
          >
            <LogOut className="size-4" aria-hidden />
          </SignOutButton>
        </div>
      </div>
    </>
  );
}
