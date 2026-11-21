import { addDays, format } from "date-fns";
import type { DayScheduleConstraints } from "@/features/planner/blocks";
import type { Block, DayPlan, ISODate } from "@/types/domain";

export const DEFAULT_WAKE_TIME = "07:00";
export const DEFAULT_WIND_DOWN_MIN = 45;
export const DEFAULT_SNAP_MIN = 15;
export const DEFAULT_DEEP_WORK_CAP_MIN = 240;

export interface DayDefaults {
  sleepTargetMin: number;
  wakeTime?: string;
  windDownMin?: number;
  snapMin?: number;
  deepWorkCapMin?: number;
}

/**
 * Per-day boundaries come from the saved DayPlan when one exists, otherwise from
 * the user's sleep target plus calm defaults. One source of truth for the board,
 * the review aggregation and the insight rules.
 */
export function dayConstraintsFor(
  date: ISODate,
  plan: DayPlan | undefined,
  defaults: DayDefaults,
): DayScheduleConstraints {
  return {
    date,
    wakeTime: plan?.wakeTime ?? defaults.wakeTime ?? DEFAULT_WAKE_TIME,
    sleepTargetMin: plan?.sleepTargetMin ?? defaults.sleepTargetMin,
    windDownMin: plan?.windDownMin ?? defaults.windDownMin ?? DEFAULT_WIND_DOWN_MIN,
    snapMin: defaults.snapMin ?? DEFAULT_SNAP_MIN,
    commitments: plan?.commitments ?? [],
  };
}

/** Planned minutes for a day: everything except skipped blocks. Never a score. */
export function plannedMinutes(
  blocks: readonly Pick<Block, "plannedMin" | "status">[],
): number {
  let total = 0;
  for (const block of blocks) {
    if (block.status === "skipped") continue;
    total += Math.max(0, Math.round(block.plannedMin));
  }
  return total;
}

export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const dt = new Date(y, m - 1, d);
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

/** Local midnight built from parts, so a DST transition can never shift the day. */
export function localDateFromISO(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

export function shiftISODate(date: ISODate, days: number): ISODate {
  if (!isValidISODate(date)) return date;
  return toISODate(addDays(localDateFromISO(date), days));
}

export function formatDayLabel(date: ISODate): string {
  if (!isValidISODate(date)) return date;
  return format(localDateFromISO(date), "EEE d MMM");
}

/** Whole calendar days between two ISO dates. UTC maths only, so DST cannot skew it. */
export function daysBetweenISO(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000,
  );
}

export function isoDatesInRange(start: ISODate, end: ISODate, limit = 400): ISODate[] {
  if (!isValidISODate(start) || !isValidISODate(end) || end < start) return [];
  const out: ISODate[] = [];
  let cursor = start;
  while (cursor <= end && out.length < limit) {
    out.push(cursor);
    cursor = shiftISODate(cursor, 1);
  }
  return out;
}

export function minutesToClock(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function localDateAndMinute(ms: number): { date: ISODate; minuteOfDay: number } {
  const d = new Date(ms);
  return {
    date: toISODate(d),
    minuteOfDay: d.getHours() * 60 + d.getMinutes(),
  };
}
