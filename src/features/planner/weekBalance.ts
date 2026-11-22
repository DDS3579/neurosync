import { startOfWeek } from "date-fns";

import { capacity } from "@/features/planner/blocks";
import {
  dayConstraintsFor,
  formatDayLabel,
  formatMinutes,
  isoDatesInRange,
  localDateFromISO,
  plannedMinutes,
  toISODate,
} from "@/features/planner/dayContext";
import type { Block, DayPlan, ISODate, Task, UserSettings } from "@/types/domain";

export type WeekDayStatus = "empty" | "clear" | "over";

export interface WeekDaySummary {
  date: ISODate;
  label: string;
  blockCount: number;
  doneCount: number;
  plannedMin: number;
  availableMin: number;
  /** Available minus planned. Negative means more planned than the window holds. */
  deltaMin: number;
  status: WeekDayStatus;
  suggestion: string;
}

export interface WeekBalance {
  start: ISODate;
  end: ISODate;
  days: WeekDaySummary[];
  plannedMin: number;
  availableMin: number;
  doneCount: number;
  overDays: number;
  clearDays: number;
  /** Calm, factual lines. Never a score, never a ranking. */
  suggestions: string[];
}

/** Monday-based week containing the given ISO date. */
export function weekStartFor(date: ISODate): ISODate {
  return toISODate(startOfWeek(localDateFromISO(date), { weekStartsOn: 1 }));
}

function suggestionFor(status: WeekDayStatus, deltaMin: number): string {
  if (status === "empty") return "Nothing planned yet — open the day when you are ready.";
  if (status === "over") {
    return `${formatMinutes(Math.abs(deltaMin))} more planned than the open window. Moving a block, or leaving it, are both fine.`;
  }
  return `${formatMinutes(deltaMin)} of open time left. A calm buffer, or room for one more block.`;
}

export function buildWeekBalance(params: {
  startISO: ISODate;
  blocks: readonly Block[];
  tasks: readonly Task[];
  plans?: readonly DayPlan[];
  settings: Pick<UserSettings, "sleepTargetMin" | "deepWorkCapMin" | "snapMin">;
}): WeekBalance {
  const start = weekStartFor(params.startISO);
  const dates = isoDatesInRange(start, toISODate(new Date(localDateFromISO(start).getTime() + 6 * 86_400_000)), 7);
  const kindByTaskId = new Map(params.tasks.map((task) => [task.id, task.kind]));
  const plansByDate = new Map((params.plans ?? []).map((plan) => [plan.date, plan]));

  const days: WeekDaySummary[] = dates.map((date) => {
    const dayBlocks = params.blocks.filter((block) => block.plannedDate === date);
    const activeBlocks = dayBlocks.filter((block) => block.status !== "skipped");
    const constraints = dayConstraintsFor(date, plansByDate.get(date), {
      sleepTargetMin: params.settings.sleepTargetMin,
      deepWorkCapMin: params.settings.deepWorkCapMin,
      snapMin: params.settings.snapMin,
    });
    const summary = capacity({
      wakeTime: constraints.wakeTime,
      sleepTargetMin: constraints.sleepTargetMin,
      windDownMin: constraints.windDownMin,
      commitments: constraints.commitments ?? [],
      blocks: activeBlocks.map((block) => ({
        kind: kindByTaskId.get(block.taskId) ?? "shallow",
        plannedMin: block.plannedMin,
        status: block.status,
      })),
      deepWorkCapMin: params.settings.deepWorkCapMin,
    });
    const planned = plannedMinutes(activeBlocks);
    const deltaMin = summary.availableMin - planned;
    const status: WeekDayStatus =
      activeBlocks.length === 0 ? "empty" : deltaMin < 0 ? "over" : "clear";
    return {
      date,
      label: formatDayLabel(date),
      blockCount: activeBlocks.length,
      doneCount: activeBlocks.filter((block) => block.status === "done").length,
      plannedMin: planned,
      availableMin: summary.availableMin,
      deltaMin,
      status,
      suggestion: suggestionFor(status, deltaMin),
    };
  });

  const plannedMin = days.reduce((sum, day) => sum + day.plannedMin, 0);
  const availableMin = days.reduce((sum, day) => sum + day.availableMin, 0);
  const doneCount = days.reduce((sum, day) => sum + day.doneCount, 0);
  const overDays = days.filter((day) => day.status === "over").length;
  const clearDays = days.filter((day) => day.status === "clear").length;

  const suggestions: string[] = [];
  if (overDays > 0) {
    suggestions.push(
      `${overDays} ${overDays === 1 ? "day has" : "days have"} more planned than the open window. Nothing is locked — moving a block is optional.`,
    );
  } else if (plannedMin > 0) {
    suggestions.push("No day is over its open window this week.");
  } else {
    suggestions.push("No blocks are placed this week yet.");
  }
  const biggestOpen = [...days]
    .filter((day) => day.status !== "over")
    .sort((a, b) => b.deltaMin - a.deltaMin)[0];
  if (biggestOpen && biggestOpen.deltaMin >= 60) {
    suggestions.push(
      `${biggestOpen.label} has ${formatMinutes(biggestOpen.deltaMin)} of open time if you want to spread work there.`,
    );
  }

  return {
    start,
    end: dates[dates.length - 1] ?? start,
    days,
    plannedMin,
    availableMin,
    doneCount,
    overDays,
    clearDays,
    suggestions,
  };
}
