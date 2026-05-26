import { GOWN_CATEGORIES, type GownCategoryId } from "@/lib/types";

export type SizeOption = {
  value: string;
  label: string;
  group?: string;
};

function evenSizesThrough(max: number): string[] {
  const sizes: string[] = [];
  for (let n = 0; n <= max; n += 2) sizes.push(String(n));
  return sizes;
}

/** US formal even sizes — bridal, MOTB, women, maternity, and girls (adult formal group). */
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

const KIDS_SIZE_SET = new Set<string>(KIDS_SIZES);

const JUNIOR_SIZES = ["J6", "J8", "J10", "J12", "J14", "J16", "J18"] as const;

export const ADULT_GOWN_CATEGORY_IDS = [
  "bridal",
  "mother-of-the-bride",
  "women",
  "maternity",
] as const satisfies readonly GownCategoryId[];

function toOptions(
  values: readonly string[],
  group?: string,
): readonly SizeOption[] {
  return values.map((value) => ({ value, label: value, group }));
}

/** Adult formal rows for girls UI — skip numerics already under Kids (one Select value per size). */
function adultFormalForGirlsDisplay(): readonly string[] {
  return ADULT_FORMAL_SIZES.filter((size) => !KIDS_SIZE_SET.has(size));
}

const GIRLS_SIZE_OPTIONS: readonly SizeOption[] = [
  ...toOptions(TODDLER_SIZES, "Toddler"),
  ...toOptions(KIDS_SIZES, "Kids"),
  ...toOptions(JUNIOR_SIZES, "Junior"),
  ...toOptions(adultFormalForGirlsDisplay(), "Adult formal"),
];

const ADULT_CATEGORY_SIZE_OPTIONS: readonly SizeOption[] = [
  ...toOptions(JUNIOR_SIZES, "Junior"),
  ...toOptions(ADULT_FORMAL_SIZES, "Adult formal"),
];

export const GOWN_SIZES_BY_CATEGORY: Record<
  GownCategoryId,
  readonly SizeOption[]
> = {
  bridal: ADULT_CATEGORY_SIZE_OPTIONS,
  "mother-of-the-bride": ADULT_CATEGORY_SIZE_OPTIONS,
  women: ADULT_CATEGORY_SIZE_OPTIONS,
  maternity: ADULT_CATEGORY_SIZE_OPTIONS,
  girls: GIRLS_SIZE_OPTIONS,
};

/** Deduped union of every valid stored size value (browse with no category). */
export const ALL_VALID_SIZE_VALUES: readonly string[] = [
  ...new Set([
    ...TODDLER_SIZES,
    ...KIDS_SIZES,
    ...JUNIOR_SIZES,
    ...ADULT_FORMAL_SIZES,
  ]),
];

export function isAdultGownCategory(
  category: GownCategoryId,
): category is (typeof ADULT_GOWN_CATEGORY_IDS)[number] {
  return (ADULT_GOWN_CATEGORY_IDS as readonly string[]).includes(category);
}

export function getSizeOptionsForCategory(
  category: GownCategoryId,
): readonly SizeOption[] {
  return GOWN_SIZES_BY_CATEGORY[category];
}

export function getSizeValuesForCategory(category: GownCategoryId): string[] {
  if (category === "girls") {
    return [
      ...new Set([
        ...TODDLER_SIZES,
        ...KIDS_SIZES,
        ...JUNIOR_SIZES,
        ...ADULT_FORMAL_SIZES,
      ]),
    ];
  }
  return getSizeOptionsForCategory(category).map((o) => o.value);
}

export function isValidSizeForCategory(
  category: GownCategoryId,
  size: string,
): boolean {
  return getSizeValuesForCategory(category).includes(size);
}

/** Allowed size filter values for `/browse` given optional category nav. */
export function getBrowseAllowedSizes(
  category?: GownCategoryId,
): readonly string[] {
  if (category) return getSizeValuesForCategory(category);
  return ALL_VALID_SIZE_VALUES;
}

/** Size pills / selects — category-scoped or full union with group labels. */
export function getSizeFilterOptions(
  category?: GownCategoryId | null,
): readonly SizeOption[] {
  if (category) return getSizeOptionsForCategory(category);

  return [
    ...toOptions(TODDLER_SIZES, "Toddler"),
    ...toOptions(KIDS_SIZES, "Kids"),
    ...toOptions(JUNIOR_SIZES, "Junior"),
    ...toOptions(ADULT_FORMAL_SIZES, "Adult formal"),
  ];
}

/** Grouped options for listing form `<Select>` (optgroups per size system). */
export function getSizeSelectGroups(
  category: GownCategoryId,
): { label: string; options: { value: string; label: string }[] }[] {
  const options = getSizeOptionsForCategory(category);
  const groups = new Map<string, { value: string; label: string }[]>();

  for (const opt of options) {
    const key = opt.group ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ value: opt.value, label: opt.label });
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
