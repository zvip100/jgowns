"use client";

import ErrorStateCard from "@/components/ErrorStateCard";
import { useReportBoundaryError } from "@/hooks/useReportBoundaryError";

type AdminErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AdminError({ error, unstable_retry }: AdminErrorProps) {
  useReportBoundaryError(error, "errorBoundary.admin");

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-10"
      role="alert"
    >
      <ErrorStateCard onRetry={unstable_retry} />
    </div>
  );
}
