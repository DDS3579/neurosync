import { differenceInMinutes, format, parseISO, startOfDay, subDays } from "date-fns";
import { z } from "zod";

import type { ISODate, ISODateTime } from "@/types/domain";

export function toLocalISODate(date: Date = new Date()): ISODate {
  return format(date, "yyyy-MM-dd");
}

export function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseTimeHHMM(hhmm: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export interface SleepWindowResult {
  bedtime: ISODateTime;
  wakeTime: ISODateTime;
  durationMin: number;
  crossedMidnight: boolean;
}

/**
 * Computes local bedtime/wakeTime ISO timestamps and duration in minutes.
 * When bedtime HH:mm is later than wakeTime HH:mm, bedtime is placed on the
 * calendar day before `wakeDateISO` (crossing midnight).
 */
export function computeSleepWindow(params: {
  wakeDateISO: ISODate;
  bedtimeHHMM: string;
  wakeTimeHHMM: string;
}): SleepWindowResult | null {
  const bedParts = parseTimeHHMM(params.bedtimeHHMM);
  const wakeParts = parseTimeHHMM(params.wakeTimeHHMM);
  if (!bedParts || !wakeParts) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.wakeDateISO)) return null;

  const wakeDay = startOfDay(parseISO(params.wakeDateISO));
  if (Number.isNaN(wakeDay.getTime())) return null;

  const wakeDate = new Date(
    wakeDay.getFullYear(),
    wakeDay.getMonth(),
    wakeDay.getDate(),
    wakeParts.hours,
    wakeParts.minutes,
    0,
    0,
  );

  const bedTotalMin = bedParts.hours * 60 + bedParts.minutes;
  const wakeTotalMin = wakeParts.hours * 60 + wakeParts.minutes;
  const crossedMidnight = bedTotalMin > wakeTotalMin;

  const bedDay = crossedMidnight ? subDays(wakeDay, 1) : wakeDay;
  const bedDate = new Date(
    bedDay.getFullYear(),
    bedDay.getMonth(),
    bedDay.getDate(),
    bedParts.hours,
    bedParts.minutes,
    0,
    0,
  );

  const durationMin = Math.max(0, differenceInMinutes(wakeDate, bedDate));

  return {
    bedtime: format(bedDate, "yyyy-MM-dd'T'HH:mm:ss"),
    wakeTime: format(wakeDate, "yyyy-MM-dd'T'HH:mm:ss"),
    durationMin,
    crossedMidnight,
  };
}

export function extractHHMM(isoDateTime: string, fallback: string): string {
  const parsed = parseISO(isoDateTime);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return format(parsed, "HH:mm");
}

const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const sleepFormSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid wake-up date."),
    bedtimeHHMM: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid bedtime."),
    wakeTimeHHMM: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid wake time."),
    quality: ratingSchema,
    rested: ratingSchema,
    interruptions: z.number().int().min(0, "Cannot be negative.").max(30, "Enter 30 or fewer."),
  })
  .superRefine((values, ctx) => {
    const computed = computeSleepWindow({
      wakeDateISO: values.date,
      bedtimeHHMM: values.bedtimeHHMM,
      wakeTimeHHMM: values.wakeTimeHHMM,
    });
    if (!computed || computed.durationMin <= 0 || computed.durationMin > 1440) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wakeTimeHHMM"],
        message: "Sleep duration must be between 1 minute and 24 hours.",
      });
    }
  });

export type SleepFormValues = z.input<typeof sleepFormSchema>;
