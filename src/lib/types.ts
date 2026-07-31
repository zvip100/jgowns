export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string | null;
  location: string | null;
  condition: GownCondition;
  category: GownCategoryId | null;
  sell_mode: SellMode;
  bundle_price: number | null;
  image_urls: string[];
  image_blur_data_urls: string[];
  contact_email: string | null;
  contact_phone: string | null;
  contact_methods: ContactMethod[];
  status: 'active' | 'sold' | 'removed' | 'pending_payment';
  created_at: string;
};

/** One Stripe Checkout attempt for a listing's one-time publishing fee. */
export type ListingPayment = {
  id: string;
  listing_id: string;
  user_id: string;
  stripe_session_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'expired';
  created_at: string;
  paid_at: string | null;
};

export const SELL_MODES = ['individual', 'set_only', 'either'] as const;
export type SellMode = (typeof SELL_MODES)[number];

/** How a buyer may reach the seller on the listing's phone number. */
export const CONTACT_METHODS = ['call', 'text'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  call: 'Call',
  text: 'Text',
};

/** One physical gown (size variant) belonging to a listing. */
export type ListingSize = {
  id: string;
  listing_id: string;
  size: string;
  size_group: SizeGroupSlug;
  price: number;
  status: 'available' | 'sold';
  sort_order: number;
  created_at: string;
};

export type ListingWithSizes = Listing & { sizes: ListingSize[] };

/** Error shape returned from listing read helpers (Supabase failures, etc.). */
export type ListingReadError = { message: string } | null;

export type ListingByIdResult = {
  listing: ListingWithSizes | null;
  error: ListingReadError;
};

export type ListingsListResult = {
  listings: ListingWithSizes[] | null;
  error: ListingReadError;
};

export type ListingsPageResult = {
  listings: ListingWithSizes[] | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: ListingReadError;
};

export type PriceBounds = {
  minBound: number;
  maxBound: number;
};

/**
 * One size entry as submitted from the listing form (no DB identity yet).
 * `price` is omitted for set-only listings — the server stamps each variant
 * with the shared set price.
 */
export type ListingSizeInput = {
  size: string;
  size_group: SizeGroupSlug;
  price?: number;
};

export type ListingFormData = Omit<Listing, 'id' | 'user_id' | 'created_at'> & {
  sizes: ListingSizeInput[];
};

/** Client-side state for one size row in the listing form. */
export type ListingSizeRowState = {
  key: string;
  size: string;
  size_group: SizeGroupSlug | null;
  price: string;
};

/** Client-side state for one image slot in the listing form. */
export type ImageSlotState = {
  id: string;
  preview: string | null;
  imageFile: File | null;
  optimizedDataUrl: string | null;
  blurPromise: Promise<string | null>;
  optimizing: boolean;
  optimizeError: string;
  existingUrl: string | null;
};

export const MAX_LISTING_IMAGES = 3;

export const GOWN_CATEGORIES = [
  { id: "bridal", label: "Bridal" },
  { id: "mother-of-the-bride", label: "Mother of the Bride" },
  { id: "girls", label: "Girls" },
  { id: "women", label: "Women" },
  { id: "maternity", label: "Maternity" },
] as const;

export type GownCategoryId = (typeof GOWN_CATEGORIES)[number]["id"];

export const SIZE_GROUPS = ["toddler", "kids", "junior", "adult"] as const;
export type SizeGroupSlug = (typeof SIZE_GROUPS)[number];

export const GOWN_COLORS = ['Beige', 'Black', 'Blush', 'Champagne', 'Dusty Blue', 'Emerald', 'Gold', 'Ivory', 'Light Blue', 'Mauve', 'Navy', 'Pink', 'Plum', 'Silver', 'White', 'Other'];
export const LOCATIONS = ['Borough Park', 'Catskills', 'Lakewood', 'Monroe', 'Monsey', 'Williamsburg', 'Other'];
export const GOWN_CONDITIONS = ['Brand New', 'Perfect Condition', 'Needs Alterations'] as const;
export type GownCondition = typeof GOWN_CONDITIONS[number];

/** Next.js `searchParams` shape for `/browse` and related components. */
export type PageSearchParams = {
  [key: string]: string | string[] | undefined;
};

/** Validated `/browse` filter state (from `parseBrowseFilters` in `browse-filters`). */
export type BrowseFilters = {
  category?: GownCategoryId;
  /** URL size filter tokens — e.g. `a:8`, `k:10`. */
  size?: string[];
  color?: string[];
  location?: string[];
  cond?: string;
  minPrice?: number;
  maxPrice?: number;
};

/** Server actions that return an optional user-facing error string (stay on same page). */
export type ServerActionErrorResult = {
  error?: string;
};

// --- Buyer wishlist (Phase 1, docs/wishlist-spec.md) ---

export const WISHLIST_STORAGE_KEY = "jgowns:wishlist:v1";
export const WISHLIST_STORAGE_VERSION = 1;
export const WISHLIST_MAX_ITEMS = 50;

/** `active`/`sold` come from a live status refresh; `unavailable` = removed or hard-deleted. */
export type WishlistItemStatus = "active" | "sold" | "unavailable";

/** Display snapshot captured at add time (and self-healed on refresh) so a
 * sold/removed row can still render without a readable listing row. */
export type WishlistSnapshot = {
  title: string;
  priceLabel: string;
  image: string | null;
  blurDataUrl: string | null;
};

export type WishlistItem = {
  listingId: string;
  addedAt: string;
  status: WishlistItemStatus;
  snapshot: WishlistSnapshot;
};

export type WishlistStorageValue = {
  version: number;
  /** The account this cache mirrors. `null` = a pure guest cache (nobody has
   * signed in on this device). Set to a user's id once their account list has
   * been mirrored in; drives the sign-in merge-vs-discard decision. */
  ownerId: string | null;
  items: WishlistItem[];
};

/** One local item sent to `mergeWishlist`; `addedAt`/`status` are re-derived
 * server-side from the account row + live listing, so only these travel. */
export type WishlistMergeItem = {
  listingId: string;
  snapshot: WishlistSnapshot;
};

/** One row of a `GET /api/wishlist/status` response; ids absent from the
 * response are "no longer available" (removed or hard-deleted). */
export type WishlistStatusEntry = {
  id: string;
  status: "active" | "sold";
  snapshot: WishlistSnapshot;
};

export type WishlistStatusResponse = {
  items: WishlistStatusEntry[];
};
