"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import type { ReactNode } from "react";

type AdminNavSheetProps = {
  children: ReactNode;
};

/**
 * Drawer navigation below xl. The only client leaf in the admin chrome: it owns
 * the open state and closes on a route change, which Radix does not do on its
 * own, so a tapped link never leaves the drawer covering the page it opened.
 */
export function AdminNavSheet({ children }: AdminNavSheetProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        aria-label="Open admin menu"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d8c9b5] bg-white/60 text-(--ink) transition-colors hover:bg-white/90"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-68! max-w-68! flex-col gap-0 border-(--line) bg-[#f8f3ea] p-0"
      >
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
