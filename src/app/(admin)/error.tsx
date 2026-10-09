"use client";

import { useEffect } from "react";

import ErrorStateCard from "@/components/ErrorStateCard";

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
    </div>
  );
}
