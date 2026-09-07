import Link from "next/link";

import Logo from "@/components/Logo";

import { AdminNavPanel } from "./AdminNavPanel";
import { AdminNavSheet } from "./AdminNavSheet";

type AdminTopBarProps = {
  adminEmail: string | null;
};

/**
 * Chrome below xl. The sidebar's 240px is width the eight-column listings table
 * needs (it wants 960px and only clears that at 1280 with the rail in place),
 * so under xl the nav moves into a drawer and the table gets the viewport.
 */
export function AdminTopBar({ adminEmail }: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-(--line) bg-[#f8f3ea]/95 px-4 py-3 backdrop-blur-sm xl:hidden">
      <AdminNavSheet>
        <AdminNavPanel adminEmail={adminEmail} />
      </AdminNavSheet>

      <Link href="/admin" aria-label="Admin overview" className="flex flex-col">
        <Logo className="h-6 w-auto" />
        <span className="-mt-0.5 text-[0.58rem] font-semibold tracking-[0.18em] text-(--accent-deep) uppercase">
          Admin
        </span>
      </Link>
    </header>
  );
}
