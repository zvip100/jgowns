import { GOWN_CATEGORIES, SIZE_GROUPS, type GownCategoryId, type SizeGroupSlug } from "@/lib/types";

export { SIZE_GROUPS };
export type { SizeGroupSlug };

/** Browse URL prefix per group — `?size=a:8,k:10` (see browse-params.ts). */
export const SIZE_URL_PREFIX: Record<SizeGroupSlug, string> = {
  toddler: "t",
  kids: "k",
  junior: "j",
  adult: "a",
};

const URL_PREFIX_TO_GROUP: Record<string, SizeGroupSlug> = {
  t: "toddler",
  k: "kids",
  j: "junior",
  a: "adult",
};

export type SizeOption = {
  sizeGroup: SizeGroupSlug;
  /** Stored in `listings.size` — display label (e.g. `8`, `J10`, `8T`). */
  value: string;
  label: string;
  /** Accordion / filter section heading. */
  group?: string;
  /** Browse filter URL token — e.g. `a:8`. */
  filterToken: string;
};

function evenSizesThrough(max: number): string[] {
  const sizes: string[] = [];
  for (let n = 0; n <= max; n += 2) sizes.push(String(n));
  return sizes;
}

/** US formal even sizes — bridal, MOTB, women, maternity, and girls (adult group). */
export const ADULT_FORMAL_SIZES = evenSizesThrough(36) as readonly string[];

const TODDLER_SIZES = [
  "2T",
  "3T",
  "4T",
  "5T",
  "6T",
  "7T",
  "8T",
  "9T",
  "10T",
] as const;

const KIDS_SIZES = ["3", "5", "6", "7", "8", "10", "12", "14", "16"] as const;

const JUNIOR_SIZES = ["J6", "J8", "J10", "J12", "J14", "J16", "J18"] as const;

export const ADULT_GOWN_CATEGORY_IDS = [
  "bridal",
  "mother-of-the-bride",
  "women",
  "maternity",
] as const satisfies readonly GownCategoryId[];

const SIZE_GROUP_DEFS = [
  { slug: "toddler" as const, label: "Toddler", sizes: TODDLER_SIZES },
  { slug: "kids" as const, label: "Kids", sizes: KIDS_SIZES },
  { slug: "junior" as const, label: "Junior", sizes: JUNIOR_SIZES },
  { slug: "adult" as const, label: "Adult formal", sizes: ADULT_FORMAL_SIZES },
] as const;

const CATEGORY_GROUP_SLUGS: Record<GownCategoryId, readonly SizeGroupSlug[]> = {
  bridal: ["junior", "adult"],
  "mother-of-the-bride": ["junior", "adult"],
  women: ["junior", "adult"],
  maternity: ["junior", "adult"],
  girls: ["toddler", "kids", "junior", "adult"],
};

function encodeSizeFilterToken(
  sizeGroup: SizeGroupSlug,
  size: string,
): string {
  return `${SIZE_URL_PREFIX[sizeGroup]}:${size}`;
}

export { encodeSizeFilterToken };

function buildOption(
  sizeGroup: SizeGroupSlug,
  value: string,
  groupLabel: string,
): SizeOption {
  return {
    sizeGroup,
    value,
    label: value,
    group: groupLabel,
    filterToken: encodeSizeFilterToken(sizeGroup, value),
  };
}

function buildOptionsForGroup(
  def: (typeof SIZE_GROUP_DEFS)[number],
): readonly SizeOption[] {
  return def.sizes.map((value) => buildOption(def.slug, value, def.label));
}

const ALL_SIZE_OPTIONS: readonly SizeOption[] = SIZE_GROUP_DEFS.flatMap(
  (def) => buildOptionsForGroup(def),
);

const SIZE_PAIR_KEY = (sizeGroup: SizeGroupSlug, size: string) =>
  `${sizeGroup}\0${size}`;

const VALID_PAIR_KEYS = new Set(
  ALL_SIZE_OPTIONS.map((o) => SIZE_PAIR_KEY(o.sizeGroup, o.value)),
);

function categorySizeOptions(
  category: GownCategoryId,
): readonly SizeOption[] {
  return CATEGORY_GROUP_SLUGS[category].flatMap((slug) => {
    const def = SIZE_GROUP_DEFS.find((d) => d.slug === slug)!;
    return buildOptionsForGroup(def);
  });
}

const OPTIONS_BY_CATEGORY: Record<GownCategoryId, readonly SizeOption[]> = {
  bridal: categorySizeOptions("bridal"),
  "mother-of-the-bride": categorySizeOptions("mother-of-the-bride"),
  women: categorySizeOptions("women"),
  maternity: categorySizeOptions("maternity"),
  girls: categorySizeOptions("girls"),
};

export const GOWN_SIZES_BY_CATEGORY = OPTIONS_BY_CATEGORY;

/** Union of every valid `listings.size` label (for SQL CHECK). */
export const ALL_VALID_SIZE_LABELS: readonly string[] = [
  ...new Set(ALL_SIZE_OPTIONS.map((o) => o.value)),
];

export function isAdultGownCategory(
  category: GownCategoryId,
): category is (typeof ADULT_GOWN_CATEGORY_IDS)[number] {
  return (ADULT_GOWN_CATEGORY_IDS as readonly string[]).includes(category);
}

/** Strict decode — only `t`/`k`/`j`/`a` prefixes; no full-name aliases. */
export function decodeSizeFilterToken(
  token: string,
): { sizeGroup: SizeGroupSlug; size: string } | null {
  const colon = token.indexOf(":");
  if (colon <= 0 || colon === token.length - 1) return null;

  const prefix = token.slice(0, colon);
  const sizeGroup = URL_PREFIX_TO_GROUP[prefix];
  if (!sizeGroup) return null;

  const size = token.slice(colon + 1);
  if (!VALID_PAIR_KEYS.has(SIZE_PAIR_KEY(sizeGroup, size))) return null;

  return { sizeGroup, size };
}

export function getSizeOptionsForCategory(
  category: GownCategoryId,
): readonly SizeOption[] {
  return GOWN_SIZES_BY_CATEGORY[category];
}

export function findSizeOption(
  category: GownCategoryId,
  sizeGroup: SizeGroupSlug,
  size: string,
): SizeOption | undefined {
  return getSizeOptionsForCategory(category).find(
    (o) => o.sizeGroup === sizeGroup && o.value === size,
  );
}

export function isValidSizePair(
  category: GownCategoryId,
  sizeGroup: SizeGroupSlug,
  size: string,
): boolean {
  return Boolean(findSizeOption(category, sizeGroup, size));
}

export function isValidSizeForCategory(
  category: GownCategoryId,
  sizeGroup: SizeGroupSlug,
  size: string,
): boolean {
  return isValidSizePair(category, sizeGroup, size);
}

/** Browse filter tokens allowed for `/browse` given optional category nav. */
export function getBrowseAllowedSizes(
  category?: GownCategoryId,
): readonly string[] {
  const options = category
    ? getSizeOptionsForCategory(category)
    : ALL_SIZE_OPTIONS;
  return options.map((o) => o.filterToken);
}

/** Size pills — `value` is the URL filter token (`a:8`, etc.). */
export function getSizeFilterOptions(
  category?: GownCategoryId | null,
): readonly SizeOption[] {
  const options = category
    ? getSizeOptionsForCategory(category)
    : ALL_SIZE_OPTIONS;
  return options;
}

/** Grouped options for listing form accordion. */
export function getSizeSelectGroups(category: GownCategoryId): {
  label: string;
  options: { value: string; label: string; sizeGroup: SizeGroupSlug }[];
}[] {
  const options = getSizeOptionsForCategory(category);
  const groups = new Map<
    string,
    { value: string; label: string; sizeGroup: SizeGroupSlug }[]
  >();

  for (const opt of options) {
    const key = opt.group ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      value: opt.value,
      label: opt.label,
      sizeGroup: opt.sizeGroup,
    });
  }

  return [...groups.entries()].map(([label, opts]) => ({
    label,
    options: opts,
  }));
}

/** Category labels for filter section headings when browsing all gowns. */
export const GOWN_CATEGORY_LABELS = Object.fromEntries(
  GOWN_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<GownCategoryId, string>;
