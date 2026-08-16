import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEP_LINK_CLASS =
  "inline-flex items-center gap-1 rounded-xl border border-[#e0cfb6] bg-white/70 px-3 py-2 text-xs font-semibold text-(--ink) hover:bg-white";

const STEP_DISABLED_CLASS =
  "inline-flex items-center gap-1 px-3 py-2 text-xs text-(--muted-ink) opacity-50";

type PageStepProps = {
  href: string | null;
  label: string;
  direction: "prev" | "next";
};

function PageStep({ href, label, direction }: PageStepProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const content =
    direction === "prev" ? (
      <>
        <Icon className="size-4" aria-hidden />
        {label}
      </>
    ) : (
      <>
        {label}
        <Icon className="size-4" aria-hidden />
      </>
    );

  if (!href) return <span className={STEP_DISABLED_CLASS}>{content}</span>;

  return (
    <Link href={href} className={STEP_LINK_CLASS}>
      {content}
    </Link>
  );
}

type AdminPaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

export function AdminPagination({
  page,
  totalPages,
  buildHref,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const prev = page > 1 ? buildHref(page - 1) : null;
  const next = page < totalPages ? buildHref(page + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 pt-2"
    >
      <PageStep href={prev} label="Previous" direction="prev" />

      <p className="text-sm text-(--muted-ink)">
        Page {page} of {totalPages}
      </p>

      <PageStep href={next} label="Next" direction="next" />
    </nav>
  );
}
