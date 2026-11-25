import { Suspense } from "react";
import { connection } from "next/server";
import { Plug } from "lucide-react";

import NoticePanel from "@/components/NoticePanel";
import {
  getTrafficDaily,
  getTrafficEngagement,
  getTrafficWeekly,
  trafficAsOf,
  trafficConfigured,
} from "@/lib/queries/admin/traffic";
import { ADMIN_STAT_GRID_CLASS } from "@/lib/styles";

import {
  TRAFFIC_COUNT_BLOCKS,
  TrafficAsOf,
  TrafficAsOfSkeleton,
  TrafficChartBlock,
  TrafficChartSkeleton,
  TrafficCountBlock,
  TrafficCountSkeleton,
  TrafficEngagementBlock,
  TrafficEngagementSkeleton,
} from "./traffic-blocks";

import type { ReactNode } from "react";

/** Request-time half of /admin/traffic: three reads start together, each block awaits only its own. */
export async function TrafficReport(): Promise<ReactNode> {
  await connection();

  if (!trafficConfigured()) {
    return (
      <NoticePanel
        icon={Plug}
        title="Traffic isn't connected"
        description="Add the PostHog API key to show traffic."
        className="mt-4 sm:mt-8"
      />
    );
  }

  const asOf = trafficAsOf(new Date());
  const weekly = getTrafficWeekly(asOf);
  const daily = getTrafficDaily(asOf);
  const engagement = getTrafficEngagement(asOf);
  const { headline, funnel, intent } = TRAFFIC_COUNT_BLOCKS;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label={headline.label} className={ADMIN_STAT_GRID_CLASS}>
        <Suspense fallback={<TrafficCountSkeleton block={headline} />}>
          <TrafficCountBlock weekly={weekly} {...headline} />
        </Suspense>
      </section>

      <Suspense fallback={<TrafficChartSkeleton />}>
        <TrafficChartBlock daily={daily} />
      </Suspense>

      <section aria-label="Funnels" className={ADMIN_STAT_GRID_CLASS}>
        <Suspense fallback={<TrafficCountSkeleton block={funnel} />}>
          <TrafficCountBlock weekly={weekly} {...funnel} />
        </Suspense>
        <Suspense fallback={<TrafficCountSkeleton block={intent} />}>
          <TrafficCountBlock weekly={weekly} {...intent} />
        </Suspense>
        <Suspense fallback={<TrafficEngagementSkeleton />}>
          <TrafficEngagementBlock engagement={engagement} />
        </Suspense>
      </section>

      <p className="flex flex-col gap-0.5 text-xs text-(--muted-ink)">
        <span>
          <Suspense fallback={<TrafficAsOfSkeleton />}>
            <TrafficAsOf results={Promise.all([weekly, daily, engagement])} />
          </Suspense>{" "}
          Weeks are the last 7 days including today.
        </span>
        <span>
          Visitor counts exclude test accounts and visitor days with 200 or more
          pageviews.
        </span>
        <span>
          Registrations, listings submitted, checkouts and paid listings count
          every event.
        </span>
      </p>
    </div>
  );
}
