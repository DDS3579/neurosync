import { z } from "zod";

import type { Experiment, ExperimentMetric, ISODate } from "@/types/domain";

export const EXPERIMENT_METRICS: ReadonlyArray<{
  value: ExperimentMetric;
  label: string;
}> = [
  { value: "concentration", label: "Concentration (check-in)" },
  { value: "mood", label: "Mood (check-in)" },
  { value: "energy", label: "Energy (check-in)" },
  { value: "stress", label: "Stress (check-in)" },
  { value: "focusRating", label: "Session focus (Focus Lab)" },
  { value: "reactionTime", label: "Reaction time median (Microtasks)" },
  { value: "memorySpan", label: "Memory span (Microtasks)" },
];

export const EXPERIMENT_STATUS_LABEL: Record<Experiment["status"], string> = {
  planned: "Planned",
  baseline: "Baseline",
  intervention: "Intervention",
  complete: "Complete",
};

/**
 * Derives an experiment's lifecycle status from its date windows and `todayISO` ('YYYY-MM-DD').
 */
export function deriveExperimentStatus(
  dates: Pick<
    Experiment,
    "baselineStart" | "baselineEnd" | "interventionStart" | "interventionEnd"
  >,
  todayISO: ISODate,
): Experiment["status"] {
  if (todayISO < dates.baselineStart) return "planned";
  if (todayISO <= dates.baselineEnd) return "baseline";
  if (todayISO < dates.interventionStart) return "baseline";
  if (todayISO <= dates.interventionEnd) return "intervention";
  return "complete";
}

const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid YYYY-MM-DD date.");

export const experimentFormSchema = z
  .object({
    title: z.string().trim().min(3, "Enter an experiment title.").max(120, "Keep under 120 characters."),
    hypothesis: z
      .string()
      .trim()
      .min(5, "Write a short hypothesis.")
      .max(400, "Keep under 400 characters."),
    changeDescription: z
      .string()
      .trim()
      .min(3, "Describe the small change you are testing.")
      .max(400, "Keep under 400 characters."),
    metric: z.enum([
      "concentration",
      "mood",
      "energy",
      "stress",
      "focusRating",
      "reactionTime",
      "memorySpan",
    ]),
    baselineStart: isoDateField,
    baselineEnd: isoDateField,
    interventionStart: isoDateField,
    interventionEnd: isoDateField,
    reflection: z.string().max(1000, "Keep reflection under 1000 characters.").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.baselineEnd < v.baselineStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baselineEnd"],
        message: "Baseline end must be on or after baseline start.",
      });
    }
    if (v.interventionStart <= v.baselineEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interventionStart"],
        message: "Intervention must start after baseline ends.",
      });
    }
    if (v.interventionEnd < v.interventionStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interventionEnd"],
        message: "Intervention end must be on or after intervention start.",
      });
    }
  });

export type ExperimentFormValues = z.input<typeof experimentFormSchema>;
