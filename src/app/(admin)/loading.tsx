export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-hidden>
      <div className="h-8 w-48 rounded-lg bg-[#eadfce]" />
      <div className="h-4 w-72 rounded bg-[#eadfce]/80" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-[#eadfce]/70" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[#eadfce]/60" />
    </div>
  );
}
