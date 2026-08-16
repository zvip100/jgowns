import { firstParam } from "@/lib/utils";

/** URL keys every admin list page filters on. */
export const ADMIN_SEGMENT_PARAM = "status";
export const ADMIN_SEARCH_PARAM = "q";

/** Build a relative admin list href from the current search params + overrides. */
export function adminListHref(
  pathname: string,
  current: URLSearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function firstSearchParam(
  value: string | string[] | undefined,
): string {
  return firstParam(value) ?? "";
}

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = firstSearchParam(value);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const ADMIN_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const ADMIN_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatAdminDate(iso: string): string {
  return ADMIN_DATE_FORMAT.format(new Date(iso));
}

export function formatAdminDateTime(iso: string): string {
  return ADMIN_DATE_TIME_FORMAT.format(new Date(iso));
}

/**
 * Deep link to a Checkout Session in the Stripe dashboard. Sessions live under
 * `/checkout/sessions`, not `/payments` (that path expects a PaymentIntent id),
 * and test-mode ids carry a `cs_test_` prefix, so the mode needs no extra input.
 */
export function stripeSessionUrl(sessionId: string): string {
  const mode = sessionId.startsWith("cs_test_") ? "/test" : "";
  return `https://dashboard.stripe.com${mode}/checkout/sessions/${sessionId}`;
}

const ADMIN_CURRENCY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return ADMIN_CURRENCY_FORMAT.format(cents / 100);
}
