/** Rows per admin list page (listings, users, messages, payments, logs). */
export const ADMIN_PAGE_SIZE = 30;

/**
 * Rows an overview queue card previews before deferring to its "All ..." link.
 * One number for every card, so the panels stay the same shape as data grows.
 */
export const ADMIN_QUEUE_PREVIEW_SIZE = 10;

/** Overview "new this week" queue: listings created within this many days. */
export const NEW_LISTING_WINDOW_DAYS = 7;

/** Overview "stale actives" queue: listings active longer than this many days. */
export const STALE_ACTIVE_DAYS = 30;

/** Pending-payment attention threshold (days) for the overview queue. */
export const STUCK_PENDING_PAYMENT_DAYS = 2;

/** Weeks of history charted on /admin/metrics. */
export const ADMIN_METRICS_WEEKS = 12;

/**
 * TEMPORARY, pre-production. Flips the whole admin area between real data and
 * the Phase 1 fixtures so the UI can be reviewed against a full spread of
 * states before the marketplace has one. Lives here rather than beside the
 * toggle because a "use client" module's exports cannot be read server-side.
 * To remove the feature: delete this constant, `lib/admin/demo.ts`,
 * `(admin)/AdminDemoToggle.tsx`, the `demo*` helpers in `admin-fixtures.ts`,
 * the strip in `(admin)/layout.tsx`, and the one-line branch in each loader.
 */
export const ADMIN_DEMO_COOKIE = "jgowns_admin_demo";

/**
 * The same read as `isAdminDemoMode`, for the one surface with no server value
 * to hand down: the error boundary renders above the page that would supply it.
 */
export function isAdminDemoCookie(cookie: string): boolean {
  return cookie
    .split(";")
    .some((entry) => entry.trim() === `${ADMIN_DEMO_COOKIE}=1`);
}

/**
 * Placeholder for a null cell or fact. An en dash, not an em dash: the em dash
 * is banned in every user-facing surface (AGENTS).
 */
export const ADMIN_EMPTY_VALUE = "–";

/**
 * Why a write control is inert, and why an action refused. Lives here rather
 * than in `lib/admin/guard.ts` so the client leaves that render the disabled
 * triggers can read it without pulling a server-only module into the bundle.
 */
export const ADMIN_DEMO_MODE_MESSAGE = "Turn off demo mode to make changes.";
