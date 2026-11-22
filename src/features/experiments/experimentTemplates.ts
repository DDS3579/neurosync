import { format, parseISO, startOfDay, addDays } from "date-fns";
import type { ExperimentMetric, ISODate } from "@/types/domain";

export interface ExperimentTemplate {
  id: string;
  label: string;
  title: string;
  hypothesis: string;
  changeDescription: string;
  metric: ExperimentMetric;
  baselineDays: number;
  interventionDays: number;
  gapDays: number;
  summary: string;
  caveat: string;
}

/** Ready-made N-of-1 template for the block planner. */
export const BLOCK_PLANNING_TEMPLATE: ExperimentTemplate = {
  id: "block-planning-focus",
  label: "Block planning & focus",
  title: "Does planning my day in blocks change how focused I feel?",
  hypothesis:
    "Planning my day in blocks will coincide with steadier self-rated concentration than my usual unblocked days.",
  changeDescription:
    "Each morning, split my tasks into blocks and place them on the planner timeline before starting work.",
  metric: "concentration",
  baselineDays: 7,
  interventionDays: 7,
  gapDays: 0,
  summary:
    "Two 7-day windows: a baseline week of your usual planning, then a week of placing blocks on the planner. Concentration comes from your daily check-in (1–5), so logging a check-in most days is what makes the comparison readable.",
  caveat:
    "Self-reported ratings, one person, no control group. Other things change between the two weeks too, so a difference does not show that block planning caused it.",
};

export const EXPERIMENT_TEMPLATES: readonly ExperimentTemplate[] = [BLOCK_PLANNING_TEMPLATE];

export function getExperimentTemplate(id: string): ExperimentTemplate | null {
  return EXPERIMENT_TEMPLATES.find((template) => template.id === id) ?? null;
}

export interface TemplateWindows {
  baselineStart: ISODate;
  baselineEnd: ISODate;
  interventionStart: ISODate;
  interventionEnd: ISODate;
}

const iso = (date: Date): ISODate => format(date, "yyyy-MM-dd");

/**
 * Calendar-day windows from local midnight, so month/year boundaries and DST
 * transitions never shorten or lengthen a window.
 */
export function templateWindows(
  template: ExperimentTemplate,
  todayISO: ISODate,
): TemplateWindows {
  const start = startOfDay(parseISO(todayISO));
  const baselineDays = Math.max(1, Math.round(template.baselineDays));
  const interventionDays = Math.max(1, Math.round(template.interventionDays));
  const gapDays = Math.max(0, Math.round(template.gapDays));
  const baselineEnd = addDays(start, baselineDays - 1);
  const interventionStart = addDays(baselineEnd, 1 + gapDays);
  return {
    baselineStart: iso(start),
    baselineEnd: iso(baselineEnd),
    interventionStart: iso(interventionStart),
    interventionEnd: iso(addDays(interventionStart, interventionDays - 1)),
  };
}

export interface ExperimentTemplateValues extends TemplateWindows {
  title: string;
  hypothesis: string;
  changeDescription: string;
  metric: ExperimentMetric;
  reflection: string;
}

export function applyExperimentTemplate(
  template: ExperimentTemplate,
  todayISO: ISODate,
): ExperimentTemplateValues {
  return {
    title: template.title,
    hypothesis: template.hypothesis,
    changeDescription: template.changeDescription,
    metric: template.metric,
    ...templateWindows(template, todayISO),
    reflection: "",
  };
}
