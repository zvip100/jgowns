"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { TRAFFIC_CHART_ASPECT_CLASS } from "@/lib/styles";

import { AdminChartPanel } from "../../AdminChartPanel";

export type TrafficChartPoint = {
  label: string;
  visitors: number;
  pageviews: number;
  isPartial: boolean;
};

type TrafficSeries = "visitors" | "pageviews";

export type TrafficChartRow = TrafficChartPoint & {
  visitorsSettled: number | null;
  visitorsPartial: number | null;
  pageviewsSettled: number | null;
  pageviewsPartial: number | null;
};

const trafficConfig = {
  visitors: { label: "Visitors", color: "#5b6b78" },
  pageviews: { label: "Pageviews", color: "#b3854c" },
} satisfies ChartConfig;

const GRID_STROKE = "rgba(120,93,63,0.15)";
/** One width for both panels, so their plot areas and dates line up vertically. */
const Y_AXIS_WIDTH = 40;
const SERIES: TrafficSeries[] = ["visitors", "pageviews"];

/** Splits each series into a settled line and a dashed final segment, and labels the partial day "so far". */
export function toTrafficChartRows(points: TrafficChartPoint[]): TrafficChartRow[] {
  const lastIndex = points.length - 1;
  const hasPartial = points[lastIndex]?.isPartial ?? false;

  return points.map((point, index) => {
    const isSettled = !hasPartial || index < lastIndex;
    const isPartialSegment = hasPartial && index >= lastIndex - 1;
    return {
      ...point,
      label: point.isPartial ? `${point.label} so far` : point.label,
      visitorsSettled: isSettled ? point.visitors : null,
      visitorsPartial: isPartialSegment ? point.visitors : null,
      pageviewsSettled: isSettled ? point.pageviews : null,
      pageviewsPartial: isPartialSegment ? point.pageviews : null,
    };
  });
}

type DayTickProps = {
  x?: number;
  y?: number;
  payload?: { value: string };
  lastLabel: string;
  isLastPartial: boolean;
};

/** The last tick anchors to its end so "so far" stays inside the drawing. */
function DayTick({ x = 0, y = 0, payload, lastLabel, isLastPartial }: DayTickProps) {
  const value = payload?.value ?? "";
  const isLast = value === lastLabel;
  const isEmphasized = isLast && isLastPartial;
  return (
    <text
      x={x}
      y={y}
      dy={14}
      textAnchor={isLast ? "end" : "middle"}
      fill={isEmphasized ? "var(--accent-deep)" : "var(--muted-ink)"}
      fontSize={12}
      fontWeight={isEmphasized ? 600 : 400}
    >
      {value}
    </text>
  );
}

type SeriesChartProps = {
  rows: TrafficChartRow[];
  series: TrafficSeries;
  showDates: boolean;
};

function SeriesChart({ rows, series, showDates }: SeriesChartProps) {
  const lastIndex = rows.length - 1;
  const lastLabel = rows[lastIndex]?.label ?? "";
  const isLastPartial = rows[lastIndex]?.isPartial ?? false;
  const color = `var(--color-${series})`;

  return (
    <ChartContainer config={trafficConfig} className={TRAFFIC_CHART_ASPECT_CLASS}>
      <ComposedChart
        data={rows}
        syncId="admin-traffic"
        accessibilityLayer
        margin={{ top: 6, right: 8, bottom: showDates ? 0 : 8, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="label"
          hide={!showDates}
          interval="preserveEnd"
          minTickGap={16}
          tickLine={false}
          axisLine={false}
          height={showDates ? 24 : 0}
          tick={<DayTick lastLabel={lastLabel} isLastPartial={isLastPartial} />}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          allowDecimals={false}
          interval={0}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey={series}
          type="linear"
          fill={color}
          fillOpacity={0.16}
          stroke="none"
          activeDot={{ r: 3.5, fill: color }}
          isAnimationActive={false}
        />
        <Line
          dataKey={`${series}Settled`}
          type="linear"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={false}
          tooltipType="none"
          isAnimationActive={false}
        />
        <Line
          dataKey={`${series}Partial`}
          type="linear"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={(props: { cx?: number; cy?: number; index?: number }) => (
            <g key={`partial-dot-${props.index}`}>
              {props.index === lastIndex && isLastPartial && (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={3.5}
                  fill="var(--bg-cream)"
                  stroke={color}
                  strokeWidth={2}
                />
              )}
            </g>
          )}
          activeDot={false}
          tooltipType="none"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

type TrafficChartProps = {
  points: TrafficChartPoint[];
};

/** Visitors above pageviews, each on its own scale (they differ about 15x), tooltips synced. */
export function TrafficChart({ points }: TrafficChartProps) {
  const rows = toTrafficChartRows(points);

  return (
    <AdminChartPanel title="Visitors & pageviews" subtitle={`Last ${points.length} days`}>
      <div className="mt-4 flex flex-col gap-3">
        {SERIES.map((series, index) => (
          <div key={series}>
            <p className="text-[0.62rem] font-semibold tracking-[0.18em] text-(--muted-ink) uppercase">
              {trafficConfig[series].label}
            </p>
            <SeriesChart
              rows={rows}
              series={series}
              showDates={index === SERIES.length - 1}
            />
          </div>
        ))}
      </div>
    </AdminChartPanel>
  );
}
