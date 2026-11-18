import type { Experiment, ExperimentMetric, InsightInput, ISODate } from '@/types/domain';
import { groupByDate, mean, median, round1, stdDev } from './stats';

export interface ExperimentResult {
  baseline: { n: number; mean: number | null };
  intervention: { n: number; mean: number | null };
  difference: number | null;
  sufficientData: boolean;
  direction: 'higher' | 'lower' | 'similar' | 'unknown';
  summary: string;
  caveats: string[];
  effectSizeNote?: string;
}

const MIN_DAYS = 5;

const METRIC_LABELS: Record<ExperimentMetric, string> = {
  concentration: 'concentration',
  mood: 'mood',
  energy: 'energy',
  stress: 'stress',
  focusRating: 'session focus',
  reactionTime: 'reaction time',
  memorySpan: 'memory span',
};

function similarBandForMetric(metric: ExperimentMetric): number {
  if (metric === 'reactionTime') return 15; // ms
  if (metric === 'memorySpan') return 0.4; // items
  return 0.3; // 1–5 rating scale
}

function formatMetricValue(metric: ExperimentMetric, value: number): string {
  if (metric === 'reactionTime') return `${Math.round(value)} ms`;
  if (metric === 'memorySpan') return `${round1(value)} items`;
  return `${round1(value)}/5`;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One value per logged day: check-in field, mean session focus rating, or microtask per-day median. */
function metricByDate(exp: Experiment, input: InsightInput): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  if (exp.metric === 'focusRating') {
    for (const [date, list] of groupByDate(input.focus)) {
      const m = mean(list.map((s) => s.focusRating));
      if (m !== null) out.set(date, m);
    }
  } else if (exp.metric === 'reactionTime') {
    const runs = (input.microtaskResults ?? []).filter((r) => r.task === 'reaction_time');
    for (const [date, list] of groupByDate(runs)) {
      const m = median(
        list.map((r) => (r.task === 'reaction_time' ? r.metrics.medianMs : 0)).filter((_, i) => list[i]?.task === 'reaction_time'),
      );
      if (m !== null) out.set(date, m);
    }
  } else if (exp.metric === 'memorySpan') {
    const runs = (input.microtaskResults ?? []).filter((r) => r.task === 'memory_span');
    for (const [date, list] of groupByDate(runs)) {
      const m = median(
        list.map((r) => (r.task === 'memory_span' ? r.metrics.longestSpan : 0)).filter((_, i) => list[i]?.task === 'memory_span'),
      );
      if (m !== null) out.set(date, m);
    }
  } else {
    const key = exp.metric; // 'concentration' | 'mood' | 'energy' | 'stress'
    for (const [date, list] of groupByDate(input.checkins)) {
      const m = mean(list.map((c) => c[key])); // several check-ins on one day are averaged
      if (m !== null) out.set(date, m);
    }
  }
  return out;
}

function periodValues(series: Map<ISODate, number>, start: ISODate, end: ISODate): number[] {
  const vals: number[] = [];
  for (const [date, value] of series) {
    if (date >= start && date <= end) vals.push(value); // inclusive ranges, ISO string order
  }
  return vals;
}

export function analyzeExperiment(exp: Experiment, input: InsightInput): ExperimentResult {
  const series = metricByDate(exp, input);
  const bVals = periodValues(series, exp.baselineStart, exp.baselineEnd);
  const iVals = periodValues(series, exp.interventionStart, exp.interventionEnd);
  const bMean = mean(bVals);
  const iMean = mean(iVals);
  const sufficientData = bVals.length >= MIN_DAYS && iVals.length >= MIN_DAYS;
  const difference = bMean !== null && iMean !== null ? Math.round((iMean - bMean) * 100) / 100 : null;
  const similarBand = similarBandForMetric(exp.metric);
  const isMicrotask = exp.metric === 'reactionTime' || exp.metric === 'memorySpan';

  // Direction is only stated once both periods clear the minimum — otherwise 'unknown'.
  let direction: ExperimentResult['direction'] = 'unknown';
  if (sufficientData && difference !== null) {
    direction = difference > similarBand ? 'higher' : difference < -similarBand ? 'lower' : 'similar';
  }

  const label = METRIC_LABELS[exp.metric];
  let summary: string;
  if (bMean === null || iMean === null) {
    const where = bMean === null && iMean === null ? 'either period' : 'one of the periods';
    summary = `No ${label} data was logged in ${where} yet, so there is nothing to compare. Baseline days: ${bVals.length}. Intervention days: ${iVals.length}.`;
  } else if (!sufficientData) {
    summary = `So far, ${plural(bVals.length, 'baseline day')} average ${formatMetricValue(exp.metric, bMean)} and ${plural(iVals.length, 'intervention day')} average ${formatMetricValue(exp.metric, iMean)} for ${label}. At least ${MIN_DAYS} days in each period are needed before a comparison is shown — these numbers are provisional.`;
  } else {
    // Neutral wording for every metric: "lower stress rating" or "faster reaction time" is a description, never a verdict.
    let phrase: string;
    if (exp.metric === 'reactionTime') {
      phrase =
        direction === 'similar'
          ? `similar ${label} (within ±${similarBand} ms)`
          : direction === 'lower'
            ? `faster ${label}`
            : `slower ${label}`;
    } else if (exp.metric === 'memorySpan') {
      phrase =
        direction === 'similar'
          ? `similar ${label} (within ±${similarBand} items)`
          : direction === 'higher'
            ? `longer ${label}`
            : `shorter ${label}`;
    } else {
      phrase =
        direction === 'similar'
          ? `similar ${label} rating (within ±${similarBand})`
          : `${direction} ${label} rating`;
    }
    const sign = difference !== null && difference >= 0 ? '+' : '';
    const diffLabel =
      exp.metric === 'reactionTime'
        ? `${sign}${Math.round(difference ?? 0)} ms`
        : exp.metric === 'memorySpan'
          ? `${sign}${round1(difference ?? 0)} items`
          : `${sign}${difference}`;
    const noun = isMicrotask ? `the average daily median ${label}` : `the average ${label} rating`;
    summary = `Across ${plural(bVals.length, 'baseline day')} and ${plural(iVals.length, 'intervention day')}, ${noun} went from ${formatMetricValue(exp.metric, bMean)} to ${formatMetricValue(exp.metric, iMean)} — a ${phrase} (difference ${diffLabel}). This describes your logs; it does not show the change caused the difference.`;
  }

  const caveats: string[] = [
    'This comparison does not establish causation.',
    'Self-reported ratings are subjective and can shift with mood and context.',
    'Other things changed during the period too — sleep, workload, season, life — and any of them could play a part.',
  ];
  if (isMicrotask) {
    caveats.push(
      'Microtask results shift with practice effects, device, input method, sleep, and time of day, and are not diagnostic.',
    );
  }
  if (!sufficientData) {
    caveats.push(`With fewer than ${MIN_DAYS} days in a period, averages are especially noisy.`);
  }

  let effectSizeNote: string | undefined;
  if (sufficientData && difference !== null) {
    const sb = stdDev(bVals);
    const si = stdDev(iVals);
    if (sb !== null && si !== null) {
      const pooled = Math.sqrt((sb * sb + si * si) / 2);
      if (pooled > 1e-9) {
        effectSizeNote = `For scale: the difference is about ${round1(Math.abs(difference) / pooled)} times your typical day-to-day variation — a rough sense of size, not a verdict.`;
      }
    }
  }

  return {
    baseline: { n: bVals.length, mean: bMean === null ? null : round1(bMean) },
    intervention: { n: iVals.length, mean: iMean === null ? null : round1(iMean) },
    difference,
    sufficientData,
    direction,
    summary,
    caveats,
    ...(effectSizeNote !== undefined ? { effectSizeNote } : {}),
  };
}
