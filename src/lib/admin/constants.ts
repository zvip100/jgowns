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

/**
 * Placeholder for a null cell or fact. An en dash, not an em dash: the em dash
 * is banned in every user-facing surface (AGENTS).
 */
export const ADMIN_EMPTY_VALUE = "–";
