import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { getCurrentUser } from "@/lib/queries/auth";
import SignOutButton from "@/components/SignOutButton";
import { WishlistTrigger } from "@/components/wishlist/WishlistTrigger";
import {
  NAV_ADMIN_CHIP_CLASS,
  NAV_LINK_CLASS,
  NAV_LINK_MOBILE_CLASS,
} from "@/lib/styles";

type NavAuthLinksProps = { variant: "desktop" | "mobile" };

const STYLES = {
  desktop: {
    // The chip is a crowded-bar solution. In the mobile menu, where every row
    // is a full-width 44px tap target, it would undercut the target and break
    // the list's rhythm, so that variant stays a link and only takes the icon.
    admin: NAV_ADMIN_CHIP_CLASS,
    link: NAV_LINK_CLASS,
    cta: "inline-flex items-center rounded-full border border-[#b58d5f]/70 gold-gradient px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105",
    signOut: "text-[0.86rem] font-medium tracking-wide text-[#7d6b5c] hover:text-[#a0733f]",
  },
  mobile: {
    admin: `${NAV_LINK_MOBILE_CLASS} gap-1.5`,
    link: NAV_LINK_MOBILE_CLASS,
    cta: "flex min-h-11 w-full items-center justify-center rounded-full border border-[#b58d5f]/70 gold-gradient px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)]",
    signOut: "flex min-h-11 w-full items-center text-[0.86rem] font-medium tracking-wide text-[#7d6b5c]",
  },
} as const;

export default async function NavAuthLinks({ variant }: NavAuthLinksProps) {
  const user = await getCurrentUser();
  const styles = STYLES[variant];
  // Desktop-only: the mobile trigger already sits inline next to the hamburger.
  const wishlistTrigger = variant === "desktop" ? <WishlistTrigger /> : null;

  if (user) {
    return (
      <>
        <Link href="/dashboard" className={styles.link}>
          My Listings
        </Link>
        <Link href="/dashboard/new" className={styles.cta}>
          + List a Gown
        </Link>
        {wishlistTrigger}
        {user.isAdmin && (
          <Link
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.admin}
          >
            Admin
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </Link>
        )}
        <SignOutButton className={styles.signOut} />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={styles.link}>
        Sign In
      </Link>
      <Link href="/dashboard/new" className={styles.cta}>
        Sell a Gown
      </Link>
      {wishlistTrigger}
    </>
  );
}
