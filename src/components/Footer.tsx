import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import Logo from "@/components/Logo";
import { getCurrentUser } from "@/lib/queries/auth";
import { CONTACT_EMAIL } from "@/lib/site";
import { GOWN_CATEGORIES } from "@/lib/types";

import type { ReactNode } from "react";

type FooterLink = { label: string; href: string };
type FooterColumnProps = {
  title: string;
  links: readonly FooterLink[];
  children?: ReactNode;
};

const LINK_CLASS = "text-[#7f6c5b] transition-colors hover:text-[#a0733f]";

const shopLinks: FooterLink[] = [
  { label: "Browse All Gowns", href: "/browse" },
  ...GOWN_CATEGORIES.map((category) => ({
    label: category.label,
    href: `/browse?category=${category.id}`,
  })),
];

const sellLinks: FooterLink[] = [
  { label: "List Your Gown", href: "/dashboard/new" },
  { label: "My Dashboard", href: "/dashboard" },
];

/**
 * "Create Account" is hidden for signed-in users. Reading the session makes this
 * a dynamic (per-request) hole, so it renders inside its own <Suspense> and the
 * rest of the footer stays static/cached. Uses getCurrentUser (local getClaims
 * JWT verify — no Auth-server round-trip), the same path the navbar uses.
 */
async function FooterCreateAccountLink() {
  const user = await getCurrentUser();
  if (user) return null;
  return (
    <li>
      <Link href="/register" className={LINK_CLASS}>
        Create Account
      </Link>
    </li>
  );
}

const supportLinks: FooterLink[] = [
  { label: "Contact Us", href: "/contact" },
  { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: "Terms of Use", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];

function FooterColumn({ title, links, children }: FooterColumnProps) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-(--ink)">
        {title}
      </h2>
      <ul className="flex flex-col gap-2.5 text-sm">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}

/**
 * Computed © year, isolated in its own cache scope. The footer itself can't be
 * "use cache" (it renders the dynamic, session-reading auth link), and Cache
 * Components rejects an uncached render-time new Date(); caching just the year
 * keeps it self-correcting while staying static.
 */
async function getFooterYear(): Promise<number> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  return new Date().getFullYear();
}

export default async function Footer() {
  const year = await getFooterYear();

  return (
    <footer className="mt-16 border-t border-(--line) bg-(--bg-cream)">
      <div className="mx-auto w-full max-w-375 px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="JGowns home" className="inline-block">
              <Logo className="h-8 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#7f6c5b]">
              The ultimate marketplace for modest gowns.
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#7f6c5b]">
              No middlemen, no commissions. Buyers and sellers connect directly.
            </p>
          </div>
          <FooterColumn title="Browse" links={shopLinks} />
          <FooterColumn title="Sell" links={sellLinks}>
            <Suspense fallback={null}>
              <FooterCreateAccountLink />
            </Suspense>
          </FooterColumn>
          <FooterColumn title="Support" links={supportLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-(--line) pt-6 text-sm text-[#7f6c5b] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Jgowns</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className={LINK_CLASS}>
              Terms of Use
            </Link>
            <Link href="/privacy" className={LINK_CLASS}>
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
