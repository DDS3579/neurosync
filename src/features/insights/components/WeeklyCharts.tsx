"use client";

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface DailyMinutesPoint {
  day: string;
  minutes: number;
}

export interface MethodBreakdownPoint {
  method: string;
  minutes: number;
}

const axisTick = { fontSize: 11 } as const;

const movementConfig = {
  minutes: { label: "Minutes", color: "var(--chart-3)" },
} satisfies ChartConfig;

const mindActivityConfig = {
  minutes: { label: "Minutes", color: "var(--chart-2)" },
} satisfies ChartConfig;

const methodsConfig = {
  minutes: { label: "Minutes", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const DailyMinutesBarChart = memo(function DailyMinutesBarChart({
  data,
  tone = "movement",
}: {
  data: DailyMinutesPoint[];
  tone?: "movement" | "mind";
}) {
  const config = tone === "movement" ? movementConfig : mindActivityConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-[168px] w-full">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
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
        <Bar
          dataKey="minutes"
          name="Minutes"
          fill="var(--color-minutes)"
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ChartContainer>
  );
});

export const MethodBreakdownChart = memo(function MethodBreakdownChart({
  data,
}: {
  data: MethodBreakdownPoint[];
}) {
  return (
    <ChartContainer config={methodsConfig} className="aspect-auto h-[168px] w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 6 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis
          type="category"
          dataKey="method"
          width={98}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          dataKey="minutes"
          name="Minutes"
          fill="var(--color-minutes)"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ChartContainer>
  );
});
