import { mean, roundTo } from "@/lib/insights/stats";
import type { ExperimentResult } from "@/lib/insights/types";
import type {
  DailyCheckin,
  Experiment,
  ExperimentMetric,
  FocusSession,
  InsightInput,
  ISODate,
} from "@/types/domain";

/** Each window needs this many scored days before a comparison is shown. */
export const MIN_SAMPLES_PER_WINDOW = 5;

export const EXPERIMENT_CAVEAT =
  "Your own logged days, compared side by side. Small samples and changing circumstances mean this cannot show that the change caused the difference.";

function dateRangeDates(start: ISODate, end: ISODate): Set<ISODate> {
  // Simple day-by-day walk over the stored ISO dates; the windows are short.
  const dates = new Set<ISODate>();
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor <= last) {
    dates.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function checkinScore(checkin: DailyCheckin, metric: ExperimentMetric): number | null {
  if (metric === "focusRating") return null;
  return checkin[metric];
}

function metricValues(
  input: InsightInput,
  metric: ExperimentMetric,
  dates: Set<ISODate>,
): number[] {
  const values: number[] = [];

  for (const checkin of input.checkins) {
    if (!dates.has(checkin.date)) continue;
    const score = checkinScore(checkin, metric);
    if (score !== null) values.push(score);
  }

  if (metric === "focusRating") {
    const perDay = new Map<ISODate, FocusSession[]>();

    for (const session of input.focus) {
      if (!dates.has(session.date)) continue;
      perDay.set(session.date, [...(perDay.get(session.date) ?? []), session]);
    }

    for (const sessions of perDay.values()) {
      const average = mean(sessions.map((session) => session.focusRating));
      if (average !== null) values.push(average);
    }
  }

  return values;
}

/** TODO(stub): replaced by the full Personal Experiment Lab analysis. */
export function analyzeExperiment(experiment: Experiment, input: InsightInput): ExperimentResult {
  const baselineValues = metricValues(
    input,
    experiment.metric,
    dateRangeDates(experiment.baselineStart, experiment.baselineEnd),
  );
  const interventionValues = metricValues(
    input,
    experiment.metric,
    dateRangeDates(experiment.interventionStart, experiment.interventionEnd),
  );

  const baselineMean = mean(baselineValues);
  const interventionMean = mean(interventionValues);
  const enoughData =
    baselineValues.length >= MIN_SAMPLES_PER_WINDOW &&
    interventionValues.length >= MIN_SAMPLES_PER_WINDOW;

  const delta =
    enoughData && baselineMean !== null && interventionMean !== null
      ? roundTo(interventionMean - baselineMean, 2)
      : null;

  return {
    experimentId: experiment.id,
    metric: experiment.metric,
    status: enoughData ? "ready" : "insufficient_data",
    baselineMean: baselineMean === null ? null : roundTo(baselineMean, 2),
    interventionMean: interventionMean === null ? null : roundTo(interventionMean, 2),
    delta,
    sampleCounts: {
      baseline: baselineValues.length,
      intervention: interventionValues.length,
    },
    summary: enoughData
      ? "Both windows have enough logged days for a side-by-side comparison."
      : `Log at least ${MIN_SAMPLES_PER_WINDOW} scored days in each window before comparing.`,
    caveat: EXPERIMENT_CAVEAT,
  };
}
