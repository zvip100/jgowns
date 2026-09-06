"use client";

import { useEffect } from "react";

import { startSessionRecording, stopSessionRecording } from "@/lib/analytics/client";

/**
 * `before_send` drops admin analytics events, but replay data never passes
 * through it, so recording has to be stopped and resumed directly (spec §2.6).
 * Mounting is entering `/admin` and unmounting is leaving it, which needs no
 * pathname hook and so keeps the admin tree off `useSearchParams`.
 */
export function AdminSessionRecordingGuard(): null {
  useEffect(() => {
    stopSessionRecording();
    return () => startSessionRecording();
  }, []);

  return null;
}
