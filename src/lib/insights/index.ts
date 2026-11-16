import type { Insight, InsightFeedback, InsightInput, ISODate, Pillar } from '@/types/domain';
import { filterSuppressedInsights } from './feedback';
import { RULES, type InsightRule } from './rules';

export { RULES };
export type { InsightRule };

export { buildConfidence, classifyDataConfidence, CONFIDENCE_THRESHOLDS } from './confidence';
export type { ConfidenceParams } from './confidence';
export {
  computeSnoozeUntil,
  filterSuppressedInsights,
  isInsightSuppressed,
  partitionInsightsByFeedback,
  selectOverviewInsights,
  SNOOZE_DAYS,
} from './feedback';
export type { SuppressedInsightEntry } from './feedback';

// The contract's insight API is surfaced from this barrel as well; the
// implementations live in their own sibling modules.
export { buildWeeklyReport } from './weekly';
export type { WeeklyReport } from './weekly';
export { analyzeExperiment } from './experiments';
export type { ExperimentResult } from './experiments';
export { generateDemoData } from './demo';

const MAX_INSIGHTS = 8;
const MAX_PER_PILLAR = 3;

const KIND_RANK: Record<Insight['kind'], number> = {
  observation: 0,
  reflection: 1,
  milestone: 2,
};

export interface ComputeInsightsOptions {
  cap?: number;
  maxPerPillar?: number;
  feedback?: readonly InsightFeedback[];
}

/**
 * Runs every rule against the passed `today` (never the system clock), orders
 * observations → reflections → milestones (preserving registration order on ties),
 * deduplicates overlapping topics/ids, applies per-pillar and total caps, and
 * optionally filters suppressed (dismissed / actively snoozed) insights.
 */
export function computeInsights(
  input: InsightInput,
  todayISO: ISODate,
  options?: ComputeInsightsOptions,
): Insight[] {
  const cap = options?.cap ?? MAX_INSIGHTS;
  const maxPerPillar = options?.maxPerPillar ?? MAX_PER_PILLAR;

  const found: { order: number; dedupeGroup?: string; insight: Insight }[] = [];
  RULES.forEach((rule, order) => {
    const insight = rule.run(input, todayISO);
    if (insight !== null) {
      found.push({ order, dedupeGroup: rule.dedupeGroup, insight });
    }
  });

  found.sort(
    (a, b) => KIND_RANK[a.insight.kind] - KIND_RANK[b.insight.kind] || a.order - b.order,
  );

  const seenIds = new Set<string>();
  const seenGroupKind = new Set<string>();
  const pillarCounts = new Map<Pillar, number>();
  const deduped: Insight[] = [];

  for (const entry of found) {
    const { insight, dedupeGroup } = entry;
    if (seenIds.has(insight.id)) continue;

    if (dedupeGroup) {
      const groupKey = `${dedupeGroup}:${insight.kind}`;
      if (seenGroupKind.has(groupKey)) continue;
      seenGroupKind.add(groupKey);
    }

    const pillarCount = pillarCounts.get(insight.pillar) ?? 0;
    if (pillarCount >= maxPerPillar) continue;

    seenIds.add(insight.id);
    pillarCounts.set(insight.pillar, pillarCount + 1);
    deduped.push(insight);
  }

  const visible = options?.feedback
    ? filterSuppressedInsights(deduped, options.feedback, todayISO)
    : deduped;

  return visible.slice(0, cap);
}
