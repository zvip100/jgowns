"use client";

import { useContext } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import { AdminRefreshContext } from "./AdminRefreshProvider";

import type { ReactNode } from "react";

export function AdminRefreshControl(): ReactNode {
  const context = useContext(AdminRefreshContext);

  if (!context) {
    throw new Error("AdminRefreshControl must render inside AdminRefreshProvider");
  }

  const { isPending, refreshed, startRefresh } = context;

  return (
    <div className="flex h-9 items-center justify-end gap-2">
      {/* Fixed width so the timestamp landing after mount shifts nothing. */}
      <span className="min-w-39 text-right text-xs text-(--muted-ink)">
        {refreshed && (
          <time dateTime={refreshed.dateTime} title={refreshed.title}>
            {refreshed.label}
          </time>
        )}
      </span>
      <button
        type="button"
        onClick={startRefresh}
        disabled={isPending}
        aria-busy={isPending}
        aria-label="Refresh admin data"
        title="Refresh admin data"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-(--line) text-(--muted-ink) transition hover:text-(--ink) disabled:opacity-60"
      >
        <RefreshCw
          className={cn("size-3.5", isPending && "animate-spin")}
          aria-hidden
        />
      </button>
    </div>
  );
}
