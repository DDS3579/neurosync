import { addDays, format, parseISO } from "date-fns";

import { computeInsights } from "@/lib/insights/rules";
import { INSIGHT_CAVEAT } from "@/lib/insights/rules";
import { sum } from "@/lib/insights/stats";
import type { WeeklyReport } from "@/lib/insights/types";
import type { InsightInput, ISODate } from "@/types/domain";

function inRange<T extends { date: ISODate }>(
  rows: readonly T[],
  start: ISODate,
  end: ISODate,
): T[] {
  return rows.filter((row) => row.date >= start && row.date <= end);
}

/** TODO(stub): replaced by the weekly summary the insight engine will produce. */
export function buildWeeklyReport(input: InsightInput, weekStartISO: ISODate): WeeklyReport {
  const weekEnd = format(addDays(parseISO(weekStartISO), 6), "yyyy-MM-dd");

  const sleep = inRange(input.sleep, weekStartISO, weekEnd);
  const checkins = inRange(input.checkins, weekStartISO, weekEnd);
  const focus = inRange(input.focus, weekStartISO, weekEnd);
  const movement = inRange(input.movement, weekStartISO, weekEnd);
  const nutrition = inRange(input.nutrition, weekStartISO, weekEnd);

  const days = new Set<string>([
    ...sleep.map((log) => log.date),
    ...checkins.map((log) => log.date),
    ...focus.map((log) => log.date),
  ]);

  return {
    weekStart: weekStartISO,
    weekEnd,
    daysWithData: days.size,
    counts: {
      sleep: sleep.length,
      checkins: checkins.length,
      focus: focus.length,
      movement: movement.length,
      nutrition: nutrition.length,
    },
    focusMinutes: sum(focus.map((session) => session.durationMin)),
    highlights: computeInsights(input, weekEnd).slice(0, 3),
    caveat: INSIGHT_CAVEAT,
  };
}
