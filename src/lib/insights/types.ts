import type { ExperimentMetric, Insight, ISODate } from "@/types/domain";

/** Extra shapes used by the insight engine. Domain entities live in types/domain.ts. */
export interface WeeklyReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  daysWithData: number;
  counts: {
    sleep: number;
    checkins: number;
    focus: number;
    movement: number;
    nutrition: number;
  };
  focusMinutes: number;
  highlights: Insight[];
  caveat: string;
}

export interface ExperimentResult {
  experimentId: string;
  metric: ExperimentMetric;
  status: "insufficient_data" | "ready";
  baselineMean: number | null;
  interventionMean: number | null;
  delta: number | null;
  sampleCounts: { baseline: number; intervention: number };
  summary: string;
  caveat: string;
}
