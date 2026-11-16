import { format, startOfDay, subDays } from "date-fns";
import { z } from "zod";

import type { ActivityLog, ISODate, PersonalActivityType } from "@/types/domain";

export interface PersonalActivityOption {
  value: PersonalActivityType;
  label: string;
  hint: string;
  quickDurationMin: number;
}

export const PERSONAL_ACTIVITY_OPTIONS: readonly PersonalActivityOption[] = [
  {
    value: "social",
    label: "Social time",
    hint: "Coffee, call, meal, or hangout with people",
    quickDurationMin: 30,
  },
  {
    value: "creative",
    label: "Creative",
    hint: "Drawing, writing, photography, crafting",
    quickDurationMin: 30,
  },
  {
    value: "music",
    label: "Music practice",
    hint: "Playing an instrument, singing, or focused listening",
    quickDurationMin: 30,
  },
  {
    value: "language_learning",
    label: "Language learning",
    hint: "Conversation, reading, or listening practice",
    quickDurationMin: 25,
  },
  {
    value: "puzzles_games",
    label: "Puzzles & games",
    hint: "Crosswords, chess, board games, logic puzzles",
    quickDurationMin: 30,
  },
  {
    value: "new_hobby",
    label: "New hobby",
    hint: "Practicing a personal craft or interest",
    quickDurationMin: 30,
  },
  {
    value: "novelty",
    label: "Tried something new",
    hint: "A new route, recipe, place, or small experiment",
    quickDurationMin: 20,
  },
] as const;

export const PERSONAL_ACTIVITY_LABELS: Record<PersonalActivityType, string> = Object.fromEntries(
  PERSONAL_ACTIVITY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PersonalActivityType, string>;

export const activityFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  type: z.enum([
    "social",
    "creative",
    "music",
    "language_learning",
    "puzzles_games",
    "new_hobby",
    "novelty",
  ]),
  durationMin: z
    .number()
    .int("Whole minutes only.")
    .min(1, "At least 1 minute.")
    .max(600, "Max 600 minutes."),
  enjoyment: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  note: z.string().trim().max(240, "Keep notes under 240 characters.").optional(),
});

export type ActivityFormValues = z.input<typeof activityFormSchema>;

export interface WeeklyVarietyEntry {
  type: PersonalActivityType;
  label: string;
  count: number;
  minutes: number;
}

export interface WeeklyVarietySummary {
  windowStart: ISODate;
  windowEnd: ISODate;
  distinctTypesCount: number;
  totalLogs: number;
  totalMinutes: number;
  byType: WeeklyVarietyEntry[];
}

/**
 * Summarizes distinct personal activity types logged across the last 7 days
 * (descriptive counts only, never a score).
 */
export function summarizeWeeklyActivityVariety(
  logs: readonly ActivityLog[],
  today: Date = new Date(),
): WeeklyVarietySummary {
  const end = startOfDay(today);
  const start = subDays(end, 6);
  const windowStart = format(start, "yyyy-MM-dd");
  const windowEnd = format(end, "yyyy-MM-dd");

  const counts = new Map<PersonalActivityType, { count: number; minutes: number }>();
  let totalLogs = 0;
  let totalMinutes = 0;

  for (const log of logs) {
    if (log.date < windowStart || log.date > windowEnd) continue;
    totalLogs += 1;
    totalMinutes += log.durationMin;
    const prev = counts.get(log.type) ?? { count: 0, minutes: 0 };
    counts.set(log.type, {
      count: prev.count + 1,
      minutes: prev.minutes + log.durationMin,
    });
  }

  const byType: WeeklyVarietyEntry[] = [...counts.entries()]
    .map(([type, stats]) => ({
      type,
      label: PERSONAL_ACTIVITY_LABELS[type],
      count: stats.count,
      minutes: stats.minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));

  return {
    windowStart,
    windowEnd,
    distinctTypesCount: byType.length,
    totalLogs,
    totalMinutes,
    byType,
  };
}

/** Sorts activity logs newest-first by date, then creation timestamp. */
export function sortActivityLogs(logs: readonly ActivityLog[]): ActivityLog[] {
  return [...logs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
  });
}
