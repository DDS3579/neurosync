"use client";

import { memo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface SleepChartPoint {
  day: string;
  hours: number | null;
}

export interface FocusChartPoint {
  day: string;
  minutes: number;
}

export interface MoodChartPoint {
  day: string;
  mood: number | null;
  concentration: number | null;
}

const axisTick = { fontSize: 11 } as const;

const sleepConfig = {
  hours: { label: "Sleep (hours)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const focusConfig = {
  minutes: { label: "Focus (minutes)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const moodConfig = {
  mood: { label: "Mood", color: "var(--chart-1)" },
  concentration: { label: "Concentration", color: "var(--chart-2)" },
} satisfies ChartConfig;

export const SleepChart = memo(function SleepChart({
  data,
  targetHours,
}: {
  data: SleepChartPoint[];
  targetHours: number;
}) {
  const upperBound = Math.max(Math.ceil(targetHours) + 1, 9);

  return (
    <ChartContainer config={sleepConfig} className="aspect-auto h-[168px] w-full">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={axisTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={34}
          domain={[0, upperBound]}
          tickCount={4}
          tick={axisTick}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ReferenceLine
          y={targetHours}
          stroke="var(--color-muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: "Your target",
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--color-muted-foreground)",
          }}
        />
        <Bar
          dataKey="hours"
          name="Sleep"
          fill="var(--color-hours)"
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ChartContainer>
  );
});

export const FocusChart = memo(function FocusChart({ data }: { data: FocusChartPoint[] }) {
  return (
    <ChartContainer config={focusConfig} className="aspect-auto h-[168px] w-full">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={axisTick}
        />
        <YAxis tickLine={false} axisLine={false} width={34} tickCount={4} tick={axisTick} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="minutes"
          name="Focus"
          stroke="var(--color-minutes)"
          strokeWidth={2}
          fill="var(--color-minutes)"
          fillOpacity={0.16}
          connectNulls={false}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
});

export const MoodChart = memo(function MoodChart({ data }: { data: MoodChartPoint[] }) {
  return (
    <ChartContainer config={moodConfig} className="aspect-auto h-[168px] w-full">
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={axisTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          allowDecimals={false}
          tick={axisTick}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="mood"
          name="Mood"
          stroke="var(--color-mood)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="concentration"
          name="Concentration"
          stroke="var(--color-concentration)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ChartContainer>
  );
});
