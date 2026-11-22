"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { formatMinutes, shiftISODate } from "@/features/planner/dayContext";
import { buildWeekBalance, weekStartFor } from "@/features/planner/weekBalance";
import { cn } from "@/lib/utils";
import type { Block, DayPlan, ISODate, Task, UserSettings } from "@/types/domain";

export interface PlannerWeekPanelProps {
  date: ISODate;
  todayISO: ISODate;
  blocks: readonly Block[];
  tasks: readonly Task[];
  plans: readonly DayPlan[];
  settings: UserSettings;
  onOpenDay: (date: ISODate) => void;
}

const STATUS_STYLE = {
  over: "border-warn/45 bg-warn/10 text-warn",
  clear: "border-cyan/40 bg-cyan/10 text-cyan",
  empty: "border-border bg-surface-2 text-muted-foreground",
} as const;

const STATUS_LABEL = {
  over: "Over the open window",
  clear: "Fits the open window",
  empty: "Nothing planned",
} as const;

/**
 * Seven-day board. Read-only by design: each day opens the Today board, where
 * every placement action already has a button, drag handle and keyboard path.
 */
export function PlannerWeekPanel({
  date,
  todayISO,
  blocks,
  tasks,
  plans,
  settings,
  onOpenDay,
}: PlannerWeekPanelProps) {
  const [anchor, setAnchor] = useState<ISODate>(() => weekStartFor(date));

  const week = useMemo(
    () => buildWeekBalance({ startISO: anchor, blocks, tasks, plans, settings }),
    [anchor, blocks, tasks, plans, settings],
  );

  const hasAnyBlocks = week.plannedMin > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Previous week"
            onClick={() => setAnchor(shiftISODate(week.start, -7))}
            className="rounded-control"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-body font-medium text-foreground">
            <CalendarRange className="size-3.5 text-cyan" aria-hidden />
            {week.start} → {week.end}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Next week"
            onClick={() => setAnchor(shiftISODate(week.start, 7))}
            className="rounded-control"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {week.start !== weekStartFor(todayISO) ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAnchor(weekStartFor(todayISO))}
              className="h-8 rounded-control px-2 text-caption text-cyan"
            >
              This week
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Planned this week", value: formatMinutes(week.plannedMin) },
          { label: "Open window", value: formatMinutes(week.availableMin) },
          { label: "Blocks finished", value: String(week.doneCount) },
          { label: "Days over window", value: String(week.overDays) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-control border border-border bg-surface-2 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tile.label}</p>
            <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-1.5" aria-label="Week balance suggestions">
        {week.suggestions.map((line) => (
          <li key={line} className="rounded-control border border-border bg-surface-2 px-3 py-2 text-caption text-muted-foreground">
            {line}
          </li>
        ))}
      </ul>

      {hasAnyBlocks ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {week.days.map((day) => (
            <li key={day.date}>
              <button
                type="button"
                onClick={() => onOpenDay(day.date)}
                aria-label={`Open ${day.label}${day.date === todayISO ? " (today)" : ""}`}
                className={cn(
                  "flex min-h-[132px] w-full flex-col gap-2 rounded-card border bg-surface p-3 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
                  day.date === todayISO ? "border-cyan/55" : "border-border hover:border-cyan/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-medium text-foreground">{day.label}</span>
                  <span className={cn("rounded-chip border px-1.5 py-0.5 text-[10px]", STATUS_STYLE[day.status])}>
                    {STATUS_LABEL[day.status]}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 font-mono text-caption tabular-nums">
                  <span className="text-foreground">{formatMinutes(day.plannedMin)} planned</span>
                  <span className="text-muted-foreground">/ {formatMinutes(day.availableMin)}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{day.suggestion}</p>
                <span className="mt-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                  {day.blockCount} {day.blockCount === 1 ? "block" : "blocks"} · {day.doneCount} done
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarRange />}
          title="Nothing planned this week yet"
          description="Open Today, add a task and place a block. The week board will then show how planned time compares with each day's open window."
          action={
            <Button type="button" size="sm" onClick={() => onOpenDay(todayISO)} className="rounded-control bg-violet text-white hover:bg-violet/90">
              Open today
            </Button>
          }
        />
      )}

      <p className="text-caption text-muted-foreground">
        Balance here means planned minutes compared with the open window between wake time and wind-down. It is a
        description of your plan, not a grade.
      </p>
    </div>
  );
}
