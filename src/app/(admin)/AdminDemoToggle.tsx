"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FlaskConical } from "lucide-react";

import { ADMIN_DEMO_COOKIE, isAdminDemoCookie } from "@/lib/admin/constants";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type AdminDemoToggleProps = {
  /** Omitted where nothing server-rendered can supply it. See the effect. */
  isDemo?: boolean;
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
  const [cookieDemo, setCookieDemo] = useState(false);

  // The error boundary renders above the page that reads the cookie server
  // side, so it has no value to pass. Assuming "off" there would leave the one
  // control that can turn demo mode off writing the cookie that turns it on.
  useEffect(() => {
    if (isDemo === undefined) setCookieDemo(isAdminDemoCookie(document.cookie));
  }, [isDemo]);

  const isOn = isDemo ?? cookieDemo;

  function toggle(): void {
    document.cookie = isOn
      ? `${ADMIN_DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${ADMIN_DEMO_COOKIE}=1; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isOn}
      disabled={isPending}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition disabled:opacity-60",
        // The same soft gold wash the browse filter pills use for an active
        // selection, so "on" reads the same way everywhere in the app.
        isOn
          ? "border-[#cbab84] bg-[rgba(179,133,76,0.14)] text-[#875f2f]"
          : "border-(--line) text-(--muted-ink) hover:text-(--ink)",
      )}
    >
      {isOn ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <FlaskConical className="size-3.5" aria-hidden />
      )}
      Demo data
    </button>
  );
}
