"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FlaskConical } from "lucide-react";

import { ADMIN_DEMO_COOKIE } from "@/lib/admin/constants";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type AdminDemoToggleProps = {
  isDemo: boolean;
};

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * TEMPORARY, pre-production. Writes the cookie directly instead of going
 * through a server action: it is a display preference with no privileged
 * effect, and keeping it out of `lib/actions/` means the whole feature deletes
 * without touching the action layer.
 */
export function AdminDemoToggle({ isDemo }: AdminDemoToggleProps): ReactNode {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(): void {
    document.cookie = isDemo
      ? `${ADMIN_DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${ADMIN_DEMO_COOKIE}=1; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDemo}
      disabled={isPending}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition disabled:opacity-60",
        // The same soft gold wash the browse filter pills use for an active
        // selection, so "on" reads the same way everywhere in the app.
        isDemo
          ? "border-[#cbab84] bg-[rgba(179,133,76,0.14)] text-[#875f2f]"
          : "border-(--line) text-(--muted-ink) hover:text-(--ink)",
      )}
    >
      {isDemo ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <FlaskConical className="size-3.5" aria-hidden />
      )}
      Demo data
    </button>
  );
}
