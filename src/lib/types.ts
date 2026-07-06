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
  contact_email: string;
  contact_phone: string | null;
  status: 'active' | 'sold' | 'removed';
  created_at: string;
};

export const SELL_MODES = ['individual', 'set_only', 'either'] as const;
export type SellMode = (typeof SELL_MODES)[number];

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

export const GOWN_COLORS = ['Ivory', 'White', 'Champagne', 'Black', 'Pink', 'Blush', 'Silver', 'Gold', 'Light Blue', 'Other'];
export const LOCATIONS = ['Borough Park', 'Williamsburg', 'Monsey', 'Monroe', 'Lakewood', 'Catskills', 'Other'];
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
