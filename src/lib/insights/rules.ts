import type { Insight, InsightInput, ISODate } from "@/types/domain";

/** Observations stay hidden until this many days contain data. */
export const MIN_DAYS_FOR_INSIGHTS = 3;

export const INSIGHT_CAVEAT =
  "An observation about the days you logged, not a cause. Sleep, focus, mood, and movement influence each other, and this app measures none of them directly.";

/**
 * TODO(stub): replaced by the deterministic, minimum-data-gated rule set.
 * Returning no insights is the honest result until those rules exist.
 */
export function computeInsights(_input: InsightInput, _todayISO: ISODate): Insight[] {
  return [];
}
