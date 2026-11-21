import { parseHHMM } from "@/features/reminders/reminderUtils";
import { daysBetweenISO } from "@/features/planner/dayContext";
import type { ISODate, PlannerFixedCommitment } from "@/types/domain";
import type { BusyInterval, CalendarDateRange } from "./types";

export function busyIntervalsForDate(
  intervals: readonly BusyInterval[],
  date: ISODate,
): BusyInterval[] {
  return intervals
    .filter((interval) => interval.date === date)
    .sort(
      (a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
    );
}

export function mergeBusyIntervals(
  ...lists: ReadonlyArray<readonly BusyInterval[]>
): BusyInterval[] {
  const seen = new Map<string, BusyInterval>();
  for (const list of lists) {
    for (const interval of list) {
      const key = `${interval.date}|${interval.startTime}|${interval.endTime}|${interval.title}`;
      if (!seen.has(key)) seen.set(key, interval);
    }
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id),
  );
}

export function busyDurationMin(interval: Pick<BusyInterval, "startTime" | "endTime">): number {
  const start = parseHHMM(interval.startTime);
  const end = parseHHMM(interval.endTime);
  if (start === null || end === null) return 0;
  if (end > start) return end - start;
  if (end < start) return 1440 - start + end;
  return 0;
}

/** The planner engine's only input shape: fixed commitments, however they arrived. */
export function toFixedCommitments(
  intervals: readonly BusyInterval[],
): PlannerFixedCommitment[] {
  const out: PlannerFixedCommitment[] = [];
  const seen = new Set<string>();
  for (const interval of intervals) {
    if (busyDurationMin(interval) <= 0) continue;
    const key = `${interval.date}|${interval.startTime}|${interval.endTime}|${interval.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: interval.id,
      title: interval.title,
      startTime: interval.startTime,
      endTime: interval.endTime,
    });
  }
  return out;
}

export function filterBusyRange(
  intervals: readonly BusyInterval[],
  range: CalendarDateRange,
): BusyInterval[] {
  return intervals.filter(
    (interval) => interval.date >= range.start && interval.date <= range.end,
  );
}

export function busyRangeLabel(range: CalendarDateRange): string {
  return range.start === range.end
    ? range.start
    : `${range.start} → ${range.end} (${daysBetweenISO(range.start, range.end) + 1} days)`;
}
