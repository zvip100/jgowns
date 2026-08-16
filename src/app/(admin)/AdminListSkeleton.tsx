/** Body fallback for a list page: filter shell + table. The header stays put. */
export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-hidden>
      <div className="h-28 rounded-2xl bg-[#eadfce]/70" />
      <div className="h-96 rounded-2xl bg-[#eadfce]/60" />
    </div>
  );
}
