"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { cn } from "@/lib/utils";

import { AdminSectionHeading } from "../../AdminSectionHeading";
import { formatCents } from "../../admin-url";

import type { ComponentProps } from "react";
import type { AdminMetricsPoint } from "@/lib/admin/types";

const trendConfig = {
  listings_created: {
    label: "Created",
    color: "#b3854c",
  },
  listings_sold: {
    label: "Sold",
    color: "#6f7a4a",
  },
  new_users: {
    // Slate, not a third brown: gold vs olive vs #8e6330 read as one hue at
    // stroke width and made the three series impossible to tell apart.
    label: "Users",
    color: "#5b6b78",
  },
} satisfies ChartConfig;

const feeConfig = {
  fees_collected_cents: {
    label: "Fees",
    color: "#b3854c",
  },
} satisfies ChartConfig;

// All three distributions share one series colour: they answer the same
// question ("how many listings") about different axes, so varying the hue would
// imply a relationship between them that does not exist.
const distributionConfig = {
  count: {
    label: "Listings",
    color: "#a67841",
  },
} satisfies ChartConfig;

type ChartPanelProps = {
  title: string;
  subtitle: string;
  config: ChartConfig;
  /** Chart box ratio, e.g. "aspect-[16/9]". */
  aspectClass: string;
  className?: string;
  children: ComponentProps<typeof ChartContainer>["children"];
};

function ChartPanel({
  title,
  subtitle,
  config,
  aspectClass,
  className,
  children,
}: ChartPanelProps) {
  return (
    <div
      className={cn("surface-panel hairline rounded-2xl p-4 sm:p-5", className)}
    >
      <AdminSectionHeading>{title}</AdminSectionHeading>
      <p className="mt-1 text-xs text-(--muted-ink)">{subtitle}</p>
      <ChartContainer config={config} className={cn("mt-4 w-full", aspectClass)}>
        {children}
      </ChartContainer>
    </div>
  );
}

type DistributionBar = { label: string; count: number };

type MetricsChartsProps = {
  series: AdminMetricsPoint[];
  /** Pre-labelled by the page: these arrive from SQL as stored values. */
  categories: DistributionBar[];
  priceBands: DistributionBar[];
  locations: DistributionBar[];
};

/**
 * Horizontal bars for the two distributions with long, variable-length names.
 * A vertical axis gives the label a full row instead of a rotated tick.
 */
function DistributionBars({ data }: { data: DistributionBar[] }) {
  return (
    <BarChart data={data} accessibilityLayer layout="vertical">
      <CartesianGrid horizontal={false} stroke="rgba(120,93,63,0.15)" />
      <YAxis
        dataKey="label"
        type="category"
        tickLine={false}
        axisLine={false}
        width={120}
      />
      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} />
    </BarChart>
  );
}

export function MetricsCharts({
  series,
  categories,
  priceBands,
  locations,
}: MetricsChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartPanel
        title="Listings & users"
        subtitle="Weekly counts"
        config={trendConfig}
        aspectClass="aspect-[16/9]"
      >
          <AreaChart data={series} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="rgba(120,93,63,0.15)" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="listings_created"
              type="monotone"
              fill="var(--color-listings_created)"
              fillOpacity={0.2}
              stroke="var(--color-listings_created)"
              strokeWidth={2}
            />
            <Area
              dataKey="listings_sold"
              type="monotone"
              fill="var(--color-listings_sold)"
              fillOpacity={0.15}
              stroke="var(--color-listings_sold)"
              strokeWidth={2}
            />
            <Area
              dataKey="new_users"
              type="monotone"
              fill="var(--color-new_users)"
              fillOpacity={0.1}
              stroke="var(--color-new_users)"
              strokeWidth={2}
            />
          </AreaChart>
      </ChartPanel>

      <ChartPanel
        title="Fees collected"
        subtitle="Weekly publishing fees"
        config={feeConfig}
        aspectClass="aspect-[16/9]"
      >
          <BarChart data={series} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="rgba(120,93,63,0.15)" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => formatCents(v).replace(".00", "")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    typeof value === "number" ? formatCents(value) : String(value)
                  }
                />
              }
            />
            <Bar
              dataKey="fees_collected_cents"
              fill="var(--color-fees_collected_cents)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
      </ChartPanel>

      <ChartPanel
        title="By category"
        subtitle="Listing distribution"
        config={distributionConfig}
        aspectClass="aspect-[4/3]"
      >
        <DistributionBars data={categories} />
      </ChartPanel>

      {/* Vertical, unlike its two neighbours: price bands are an ordered scale,
          and reading them left to right is what makes the shape legible. */}
      <ChartPanel
        title="By price"
        subtitle="Lowest price per listing"
        config={distributionConfig}
        aspectClass="aspect-[4/3]"
      >
        <BarChart data={priceBands} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="rgba(120,93,63,0.15)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartPanel>

      {/* Full width, and last: locations are the longest list, so this is the
          one distribution whose height keeps changing. The aspect has to go
          tall on a phone: a 21/9 box at 390px leaves each bar so little height
          that Recharts starts dropping every other axis label. */}
      <ChartPanel
        title="By location"
        subtitle="Listing distribution"
        config={distributionConfig}
        aspectClass="aspect-[3/4] sm:aspect-[16/9] lg:aspect-[21/9]"
        className="lg:col-span-2"
      >
        <DistributionBars data={locations} />
      </ChartPanel>
    </div>
  );
}
