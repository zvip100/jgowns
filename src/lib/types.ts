export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  size: string;
  color: string | null;
  location: string | null;
  condition: GownCondition;
  category: GownCategoryId | null;
  price: number;
  image_url: string;
  image_blur_data_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: 'active' | 'sold' | 'draft';
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

export type PriceBounds = {
  minBound: number;
  maxBound: number;
};

export type ListingFormData = Omit<Listing, 'id' | 'user_id' | 'created_at'> & {
  image_file?: File;
};

export const GOWN_CATEGORIES = [
  { id: "bride", label: "Bride" },
  { id: "mother-of-the-bride", label: "Mother of the Bride" },
  { id: "girls", label: "Girls" },
  { id: "women", label: "Women" },
  { id: "maternity", label: "Maternity" },
] as const;

export const GOWN_SIZES = ['0','2','4','6','8','10','12','14','16','18','20','22','24'];
export const GOWN_COLORS = ['Ivory', 'White', 'Champagne', 'Black', 'Pink', 'Blush', 'Silver', 'Gold', 'Light Blue', 'Other'];
export const LOCATIONS = ['Borough Park', 'Williamsburg', 'Monsey', 'Monroe', 'Lakewood', 'Catskills', 'Other'];
export const GOWN_CONDITIONS = ['Brand New', 'Perfect Condition', 'Needs Alterations'] as const;
export type GownCategoryId = (typeof GOWN_CATEGORIES)[number]["id"];
export type GownCondition = typeof GOWN_CONDITIONS[number];

/** Next.js `searchParams` shape for `/browse` and related components. */
export type PageSearchParams = {
  [key: string]: string | string[] | undefined;
};

/** Parsed browse filter state (from `parseFilters` in `listings-data`). */
export type ListingsFilters = {
  category?: GownCategoryId;
  size?: string;
  color?: string;
  location?: string;
  cond?: string;
  minPrice?: number;
  maxPrice?: number;
};

/** Server actions that return an optional user-facing error string (stay on same page). */
export type ServerActionErrorResult = {
  error?: string;
};
