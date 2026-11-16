import type { Insight, InsightInput, ISODate } from '@/types/domain';
import { RULES, type InsightRule } from './rules';

export { RULES };
export type { InsightRule };

// The contract's insight API is surfaced from this barrel as well; the
// implementations live in their own sibling modules.
export { buildWeeklyReport } from './weekly';
export type { WeeklyReport } from './weekly';
export { analyzeExperiment } from './experiments';
export type { ExperimentResult } from './experiments';
export { generateDemoData } from './demo';

const MAX_INSIGHTS = 8;

const KIND_RANK: Record<Insight['kind'], number> = {
  observation: 0,
  reflection: 1,
  milestone: 2,
};

/**
 * Runs every rule against the passed `today` (never the system clock), then orders
 * observations → reflections → milestones. Ties keep rule registration order via an
 * explicit index tiebreak, so ordering is stable on every engine. Caps at 8.
 */
export function computeInsights(input: InsightInput, todayISO: ISODate): Insight[] {
  const found: { order: number; insight: Insight }[] = [];
  RULES.forEach((rule, order) => {
    const insight = rule.run(input, todayISO);
    if (insight !== null) found.push({ order, insight });
  });
  found.sort(
    (a, b) => KIND_RANK[a.insight.kind] - KIND_RANK[b.insight.kind] || a.order - b.order,
  );
  return found.slice(0, MAX_INSIGHTS).map((entry) => entry.insight);
}
