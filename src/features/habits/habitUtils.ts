import { z } from "zod";

export const HABIT_TABS = ["checkin", "sleep", "movement", "nutrition", "habits", "mind"] as const;
export type HabitTab = (typeof HABIT_TABS)[number];

export const HABIT_HASH_EVENT = "nx:habits-hash-change";

/** Parses a URL hash (#checkin, #sleep, #movement, #nutrition, #habits, #mind); unknown hashes default to "checkin". */
export function parseHabitTabHash(hash: string): HabitTab {
  const cleaned = hash.replace(/^#/, "").trim().toLowerCase();
  return (HABIT_TABS as readonly string[]).includes(cleaned)
    ? (cleaned as HabitTab)
    : "checkin";
}

export const DEFAULT_HABIT_NAMES = [
  "Meditation",
  "Reading",
  "Outdoor time",
  "Stretching",
] as const;

export const HABITS_SEEDED_KEY = "nx:habits-seeded-v1";

export const habitFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a habit name.")
    .max(60, "Keep the name under 60 characters."),
});

export type HabitFormValues = z.input<typeof habitFormSchema>;
