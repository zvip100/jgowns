"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LineChart,
  Mail,
  ScrollText,
  Shirt,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the href exactly, for a parent route that owns no children. */
  exact?: boolean;
};

const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/listings", label: "Listings", icon: Shirt },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/metrics", label: "Metrics", icon: LineChart },
];

/** The only part of the sidebar that needs the client: `usePathname` for the active link. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1 px-3 pb-6">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-[rgba(179,133,76,0.14)] text-[#875f2f]"
                : "text-(--muted-ink) hover:bg-white/60 hover:text-(--ink)",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
