import { z } from "zod";

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
