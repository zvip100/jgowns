import { Suspense } from "react";

import { POSTHOG_PROJECT_URL } from "@/lib/site";

import { AdminExternalLink } from "../../AdminExternalLink";
import { AdminPageHeader } from "../../AdminPageHeader";

import { TrafficReportSkeleton } from "./traffic-blocks";
import { TrafficReport } from "./TrafficReport";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traffic",
  description: "Visitors, funnels and engagement from PostHog.",
  robots: { index: false, follow: false },
};

/** Static shell: the header renders at once; every PostHog read streams in below it. */
export default function AdminTrafficPage() {
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow="Admin"
        title="Traffic"
        description="Visitors and funnels from PostHog."
        action={
          <AdminExternalLink href={POSTHOG_PROJECT_URL}>
            Open PostHog
          </AdminExternalLink>
        }
      />
      <Suspense fallback={<TrafficReportSkeleton />}>
        <TrafficReport />
      </Suspense>
    </div>
  );
}
