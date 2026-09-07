import { AdminNavPanel } from "./AdminNavPanel";

type AdminSidebarProps = {
  adminEmail: string | null;
};

/**
 * The persistent rail, xl and up only. Below that the same panel renders in a
 * drawer (`AdminTopBar`), because the rail's width is width the tables need.
 * `h-svh` + `self-start` keep it sticky without the flex row stretching it to
 * full page height, which would leave a sticky element no travel.
 */
export function AdminSidebar({ adminEmail }: AdminSidebarProps) {
  return (
    <aside className="hidden border-(--line) bg-[#f8f3ea] xl:sticky xl:top-0 xl:flex xl:h-svh xl:w-60 xl:shrink-0 xl:flex-col xl:self-start xl:overflow-y-auto xl:border-r">
      <AdminNavPanel adminEmail={adminEmail} />
    </aside>
  );
}
