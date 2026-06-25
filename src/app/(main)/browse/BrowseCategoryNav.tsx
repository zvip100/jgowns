import Link from "next/link";

import { parseBrowseFilters } from "@/lib/browse-filters";
import { browseHref } from "@/lib/browse-url";
import type { PageSearchParams } from "@/lib/types";
import { GOWN_CATEGORIES, type GownCategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

type BrowseCategoryNavProps = {
  searchParams: PageSearchParams;
  className?: string;
  variant?: "mobile" | "desktop";
};

const chipBase =
  "inline-flex shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition-[background,box-shadow,border-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

const chipIdle =
  "border-[#e0cfb6] bg-white/50 text-[#6a5544] hover:border-[#c9a880] hover:bg-white/85 hover:text-[#3f3023]";

const chipActive =
  "border-[#a67841] bg-[linear-gradient(180deg,#c49a68,#a67841)] text-white [text-shadow:0_1px_0_rgba(74,49,21,0.2)]";

function hrefForCategory(
  resolved: PageSearchParams,
  categoryId: GownCategoryId | null,
) {
  const filters = parseBrowseFilters(resolved);
  if (categoryId) filters.category = categoryId;
  else delete filters.category;
  return browseHref(filters);
}

function categoryFromParams(resolved: PageSearchParams): string {
  return parseBrowseFilters(resolved).category ?? "";
}

export default function BrowseCategoryNav({
  searchParams,
  className,
  variant = "desktop",
}: BrowseCategoryNavProps) {
  const current = categoryFromParams(searchParams);
  const isMobile = variant === "mobile";

  return (
    <nav aria-label="Gown categories" className={cn(className)}>
      <div
        className={cn(
          isMobile &&
          "flex gap-2 overflow-x-auto overscroll-x-contain pb-1 -mb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory scroll-px-4 touch-pan-x [&::-webkit-scrollbar]:hidden",
          !isMobile && "flex flex-nowrap items-center justify-end gap-2",
        )}
      >
        <Link
          href={hrefForCategory(searchParams, null)}
          scroll={false}
          className={cn(chipBase, !current ? chipActive : chipIdle)}
        >
          All
        </Link>

        {GOWN_CATEGORIES.map((cat) => {
          const active = current === cat.id;
          return (
            <Link
              key={cat.id}
              href={hrefForCategory(searchParams, cat.id)}
              scroll={false}
              className={cn(chipBase, active ? chipActive : chipIdle)}
            >
              {cat.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
