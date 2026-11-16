import { z } from "zod";

export const nutritionFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  regularMeals: z.boolean(),
  fruitVeg: z.boolean(),
  varied: z.boolean(),
  waterGlasses: z
    .number()
    .int("Whole glasses only.")
    .min(0, "Cannot be negative.")
    .max(30, "Enter 30 or fewer."),
  note: z.string().max(500, "Keep notes under 500 characters.").optional(),
});

export type NutritionFormValues = z.input<typeof nutritionFormSchema>;
