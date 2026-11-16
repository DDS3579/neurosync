import { z } from "zod";

import type { MovementLog } from "@/types/domain";

export const MOVEMENT_TYPES: ReadonlyArray<{ value: MovementLog["type"]; label: string }> = [
  { value: "walk", label: "Walk" },
  { value: "run", label: "Run" },
  { value: "cycle", label: "Cycle" },
  { value: "sport", label: "Sport" },
  { value: "gym", label: "Strength / Gym" },
  { value: "stretch", label: "Stretch / Mobility" },
  { value: "other", label: "Other" },
];

const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const movementFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  type: z.enum(["walk", "run", "cycle", "sport", "gym", "stretch", "other"]),
  durationMin: z
    .number()
    .int("Whole minutes only.")
    .min(1, "Enter at least 1 minute.")
    .max(600, "Must be 600 minutes or less."),
  effort: ratingSchema,
});

export type MovementFormValues = z.input<typeof movementFormSchema>;
