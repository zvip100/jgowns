"use client";

import { useEffect } from "react";

import ErrorStateCard from "@/components/ErrorStateCard";

import { AdminDemoToggle } from "./AdminDemoToggle";

type AdminErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AdminError({ error, unstable_retry }: AdminErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-10"
      role="alert"
    >
      <ErrorStateCard onRetry={unstable_retry} />
      {/* TEMPORARY, pre-production. A failed admin query takes out the page
          that owns the demo toggle, so the escape hatch has to live here too:
          this boundary renders inside the layout, above the throwing page. */}
      <AdminDemoToggle isDemo={false} />
    </div>
  );
}
