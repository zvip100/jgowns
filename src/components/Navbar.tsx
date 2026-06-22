import Link from "next/link";
import { Suspense } from "react";

import Logo from "@/components/Logo";
import NavAuthLinks from "@/components/NavAuthLinks";
import {
  MobileMenuPanel,
  MobileMenuProvider,
  MobileMenuTrigger,
} from "@/components/MobileMenu";

const DESKTOP_LINK_CLASS =
  "text-[0.9rem] font-semibold tracking-[0.06em] uppercase text-[#6d5a49] hover:text-[#a0733f]";
const MOBILE_LINK_CLASS =
  "flex min-h-11 items-center text-[0.9rem] font-semibold uppercase tracking-[0.06em] text-[#6d5a49]";

export default function Navbar() {
  return (
    <MobileMenuProvider>
      <header className="sticky top-0 z-50 border-b border-[#d5c4b0] bg-[rgba(252,246,236,0.78)] backdrop-blur-lg">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex w-full max-w-375 items-center justify-between px-4 py-4 sm:px-6 lg:px-10"
        >
          <Link href="/" className="inline-flex w-fit shrink-0 items-center gap-2">
            <Logo className="h-10 w-auto md:h-11" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/browse" className={DESKTOP_LINK_CLASS}>
              Browse
            </Link>
            <Suspense fallback={null}>
              <NavAuthLinks variant="desktop" />
            </Suspense>
          </div>

          {/* Mobile hamburger */}
          <MobileMenuTrigger />
        </nav>

        {/* Mobile menu */}
        <MobileMenuPanel>
          <Link href="/browse" className={MOBILE_LINK_CLASS}>
            Browse
          </Link>
          <Suspense fallback={null}>
            <NavAuthLinks variant="mobile" />
          </Suspense>
        </MobileMenuPanel>
      </header>
    </MobileMenuProvider>
  );
}
