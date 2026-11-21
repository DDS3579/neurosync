"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { ChartCard, StatCard } from "@/components/nx";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMinutes, shiftISODate } from "@/features/planner/dayContext";
import {
  buildPlannedActualReport,
  collectBlockSamples,
  type PlannedActualGroup,
} from "@/features/planner/review/plannedVsActual";
import { LEDGER_NOTE } from "@/features/planner/review/focusLedger";
import type { Block, ISODate, Task } from "@/types/domain";

const WINDOW_OPTIONS = [7, 30, 0] as const;

const chartConfig = {
  planned: { label: "Planned (avg min)", color: "var(--chart-2)" },
  actual: { label: "Logged (avg min)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;

function GroupChart({ rows }: { rows: readonly PlannedActualGroup[] }) {
  const data = rows.map((row) => ({
    label: row.label.replace(" blocks", ""),
    planned: row.avgPlannedMin,
    actual: row.avgActualMin,
  }));
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[188px] w-full">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} width={34} tickCount={4} tick={axisTick} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="planned" name="Planned (avg min)" fill="var(--color-planned)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="actual" name="Logged (avg min)" fill="var(--color-actual)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}

const tableRows = (rows: readonly PlannedActualGroup[]) =>
  rows.map((row) => [
    row.label,
    row.n,
    `${row.avgPlannedMin}m`,
    `${row.avgActualMin}m`,
    `${row.deltaMin > 0 ? "+" : row.deltaMin < 0 ? "−" : ""}${Math.abs(row.deltaMin)}m`,
  ]);

const TABLE_COLUMNS = ["Group", "Blocks (n)", "Avg planned", "Avg logged", "Difference"];

export interface PlannerReviewPanelProps {
  todayISO: ISODate;
  blocks: readonly Block[];
  tasks: readonly Task[];
}

export function PlannerReviewPanel({ todayISO, blocks, tasks }: PlannerReviewPanelProps) {
  const [windowDays, setWindowDays] = useState<number>(30);

  const report = useMemo(() => {
    const samples = collectBlockSamples(blocks, tasks);
    return buildPlannedActualReport(
      samples,
      windowDays > 0
        ? { range: { start: shiftISODate(todayISO, -(windowDays - 1)), end: todayISO } }
        : {},
    );
  }, [blocks, tasks, todayISO, windowDays]);

  const empty = report.measuredBlocks === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-muted-foreground">
          Average logged minutes against planned minutes for the blocks you completed. Plain numbers with sample sizes —
          no verdicts and no ranking of your days.
        </p>
        <ToggleGroup
          type="single"
          value={String(windowDays)}
          onValueChange={(next) => {
            const parsed = Number(next);
            if (WINDOW_OPTIONS.includes(parsed as (typeof WINDOW_OPTIONS)[number])) setWindowDays(parsed);
          }}
          variant="outline"
          size="sm"
          aria-label="Review window"
        >
          <ToggleGroupItem value="7" className="font-mono text-caption">7d</ToggleGroupItem>
          <ToggleGroupItem value="30" className="font-mono text-caption">30d</ToggleGroupItem>
          <ToggleGroupItem value="0" className="font-mono text-caption">All</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Measured blocks" value={report.measuredBlocks} unit="blocks" hint={report.summaryLine} accent="cyan" />
        <StatCard label="Completed" value={report.doneBlocks} unit="blocks" hint={`${report.openBlocks} still open · ${report.skippedBlocks} skipped`} />
        <StatCard label="Planned time" value={formatMinutes(report.plannedMin)} hint="Everything except skipped blocks" />
        <StatCard label="Logged time" value={formatMinutes(report.actualTotalMin)} hint="From your own timer entries" accent="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="By block length"
          description="Average planned vs logged minutes per planned length"
          summary={empty ? undefined : report.summaryLine}
          tableData={{ caption: "Average planned and logged minutes by block length", columns: TABLE_COLUMNS, rows: tableRows(report.byLength) }}
          empty={empty}
          emptyMessage="Finish a block with the Focus Lab timer (or log its duration) to see planned vs logged minutes here."
          footer="Lengths are grouped to the nearest 5 minutes. Small groups are shown with their sample size, never hidden."
        >
          <GroupChart rows={report.byLength} />
        </ChartCard>

        <ChartCard
          title="By kind"
          description="Deep, shallow and recovery blocks"
          tableData={{ caption: "Average planned and logged minutes by block kind", columns: TABLE_COLUMNS, rows: tableRows(report.byKind) }}
          empty={empty}
          emptyMessage="No completed blocks with a logged duration in this window yet."
          footer="Kind comes from the block's task. Recovery blocks are counted as recovery time, never as deep work."
        >
          <GroupChart rows={report.byKind} />
        </ChartCard>
      </div>

      <div className="flex items-start gap-2 rounded-control border border-border bg-surface-2 px-3.5 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
        <div className="space-y-1 text-caption text-muted-foreground">
          {report.caveats.map((caveat) => (
            <p key={caveat}>{caveat}</p>
          ))}
          <p>{LEDGER_NOTE}</p>
        </div>
      </div>
    </div>
  );
}
