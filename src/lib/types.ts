export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  size: string;
  size_group: SizeGroupSlug;
  color: string | null;
  location: string | null;
  condition: GownCondition;
  category: GownCategoryId | null;
  price: number;
  image_urls: string[];
  image_blur_data_urls: string[];
  contact_email: string;
  contact_phone: string | null;
  status: 'active' | 'sold' | 'removed';
  created_at: string;
};

/** Error shape returned from listing read helpers (Supabase failures, etc.). */
export type ListingReadError = { message: string } | null;

export type ListingByIdResult = {
  listing: Listing | null;
  error: ListingReadError;
};

export type ListingsListResult = {
  listings: Listing[] | null;
  error: ListingReadError;
};

export type ListingsPageResult = {
  listings: Listing[] | null;
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

export type ListingFormData = Omit<Listing, 'id' | 'user_id' | 'created_at'>;

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
