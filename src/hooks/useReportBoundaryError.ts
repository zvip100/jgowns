"use client";

import { useEffect } from "react";

import { captureClientException } from "@/lib/analytics/client";

/** Logs and reports the error an `error.tsx` boundary caught. */
export function useReportBoundaryError(
  error: Error & { digest?: string },
  scope: string,
): void {
  useEffect(() => {
    captureClientException(error, scope, { digest: error.digest });
  }, [error, scope]);
}
