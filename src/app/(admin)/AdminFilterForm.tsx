"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FILTER_COUNT_BADGE_CLASS } from "@/lib/styles";
import { cn } from "@/lib/utils";

import {
  ADMIN_SEARCH_PARAM,
  ADMIN_SEGMENT_PARAM,
  adminListHref,
} from "./admin-url";

import type { SubmitEvent } from "react";

/** The accepted sweet spot for type-to-search: past a typing pause, below perceptible lag. */
const SEARCH_DEBOUNCE_MS = 300;

const inputClass =
  "h-10 w-full min-w-0 rounded-xl border border-[#e0cfb6] bg-white/70 px-3 text-sm text-(--ink) outline-none placeholder:text-[#a08770] focus-visible:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

type AdminFilterFormProps = {
  searchPlaceholder: string;
  searchValue: string;
  dateFrom: string;
  dateTo: string;
  activeSegment: string;
  /** Number of filters currently on. Zero hides the clear link. */
  activeCount: number;
  clearHref: string;
};

/**
 * Search filters as you type (debounced) and dates apply on submit, both through
 * the URL so the view stays shareable. The push runs in a transition, which keeps
 * the current table on screen instead of swapping in `loading.tsx`. Still a real
 * GET form, so it degrades to a full-page submit without JS.
 */
export function AdminFilterForm({
  searchPlaceholder,
  searchValue,
  dateFrom,
  dateTo,
  activeSegment,
  activeCount,
  clearHref,
}: AdminFilterFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchValue);
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const applied = [searchValue, dateFrom, dateTo].join("\u0000");
  const lastPushedRef = useRef(applied);

  // Re-sync only when the URL changed from somewhere else (Clear all, a status
  // pill, the back button). Ignoring our own push keeps the search box from
  // being rewritten under the cursor between keystrokes.
  useEffect(() => {
    if (applied === lastPushedRef.current) return;
    lastPushedRef.current = applied;
    setSearch(searchValue);
    setFrom(dateFrom);
    setTo(dateTo);
  }, [applied, searchValue, dateFrom, dateTo]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function pushFilters(nextSearch: string, nextFrom: string, nextTo: string) {
    clearTimeout(debounceRef.current);
    lastPushedRef.current = [nextSearch, nextFrom, nextTo].join("\u0000");

    const href = adminListHref(
      pathname,
      new URLSearchParams(searchParams.toString()),
      {
        [ADMIN_SEARCH_PARAM]: nextSearch,
        from: nextFrom,
        to: nextTo,
        page: undefined,
      },
    );
    startTransition(() => router.push(href));
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    // Dates stay on the applied URL values: a half-typed range must not ride
    // along with a keystroke. Apply commits them.
    debounceRef.current = setTimeout(
      () => pushFilters(value, dateFrom, dateTo),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    pushFilters(search, from, to);
  }

  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center"
      action=""
      method="get"
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      {/* Preserve segment + dates when submitting search */}
      {activeSegment !== "all" && (
        <input
          type="hidden"
          name={ADMIN_SEGMENT_PARAM}
          value={activeSegment}
        />
      )}

      <label className="sr-only" htmlFor="admin-search">
        {searchPlaceholder}
      </label>
      <div className="min-w-0 sm:max-w-xs sm:flex-1">
        <input
          id="admin-search"
          name={ADMIN_SEARCH_PARAM}
          type="search"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="admin-from">
          From date
        </label>
        <input
          id="admin-from"
          name="from"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className={cn(inputClass, "flex-1 sm:w-auto sm:flex-none")}
        />
        <span className="text-xs text-(--muted-ink)">to</span>
        <label className="sr-only" htmlFor="admin-to">
          To date
        </label>
        <input
          id="admin-to"
          name="to"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className={cn(inputClass, "flex-1 sm:w-auto sm:flex-none")}
        />
      </div>

      {/* Apply and Clear all share one row. Apply is only ~76px wide, so on a
          phone it left most of a row empty and pushed Clear all onto another. */}
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        {/* Apply and the busy slot travel together, so the spinner stays put
            at every width instead of drifting to the middle of the row. */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="h-10 rounded-xl border border-[#cbab84] bg-[rgba(179,133,76,0.14)] px-4 text-xs font-semibold tracking-[0.12em] text-[#875f2f] uppercase transition hover:bg-[rgba(179,133,76,0.22)]"
          >
            Apply
          </button>
          {/* One busy slot for the whole bar, not one per control: the search
              box owned it before, which read as "the search is loading" even
              when a date was what changed. Sized whether or not it is filled,
              so nothing beside it moves when a filter fires. */}
          <span
            className="flex size-4 shrink-0 items-center justify-center"
            aria-hidden
          >
            {isPending && (
              <LoaderCircle className="size-4 animate-spin text-(--accent-deep)" />
            )}
          </span>
        </div>
        {activeCount > 0 && (
          <Link
            href={clearHref}
            className="inline-flex items-center gap-2 text-xs font-semibold text-(--accent-deep) hover:text-(--ink)"
          >
            Clear all
            <Badge
              variant="outline"
              className={`${FILTER_COUNT_BADGE_CLASS} px-2 py-0.5 text-[0.66rem]`}
            >
              {activeCount}
            </Badge>
          </Link>
        )}
      </div>
    </form>
  );
}
