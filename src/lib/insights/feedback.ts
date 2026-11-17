import { addDays, format, parseISO } from 'date-fns';

import type { Insight, InsightFeedback, ISODate, Pillar } from '@/types/domain';

export const SNOOZE_DAYS = 14;

export interface SuppressedInsightEntry {
  feedback: InsightFeedback;
  insightId: string;
  title: string;
  pillar?: Pillar;
  liveInsight?: Insight;
}

export function computeSnoozeUntil(todayISO: ISODate, days: number = SNOOZE_DAYS): ISODate {
  return format(addDays(parseISO(todayISO), days), 'yyyy-MM-dd');
}

export function isInsightSuppressed(feedback: InsightFeedback, todayISO: ISODate): boolean {
  if (feedback.status === 'dismissed') return true;
  if (feedback.status === 'snoozed') {
    return Boolean(feedback.snoozeUntil && todayISO < feedback.snoozeUntil);
  }
  return false;
}

function feedbackByInsightId(feedback: readonly InsightFeedback[]): Map<string, InsightFeedback> {
  const map = new Map<string, InsightFeedback>();
  for (const row of feedback) {
    const prev = map.get(row.insightId);
    if (!prev || row.updatedAt > prev.updatedAt) {
      map.set(row.insightId, row);
    }
  }
  return map;
}

export function filterSuppressedInsights(
  insights: readonly Insight[],
  feedback: readonly InsightFeedback[],
  todayISO: ISODate,
): Insight[] {
  if (feedback.length === 0) return [...insights];
  const byId = feedbackByInsightId(feedback);
  return insights.filter((insight) => {
    const fb = byId.get(insight.id);
    return !fb || !isInsightSuppressed(fb, todayISO);
  });
}

export function partitionInsightsByFeedback(
  insights: readonly Insight[],
  feedback: readonly InsightFeedback[],
  todayISO: ISODate,
): {
  active: Insight[];
  dismissed: SuppressedInsightEntry[];
  snoozed: SuppressedInsightEntry[];
} {
  const byInsight = new Map(insights.map((ins) => [ins.id, ins]));
  const latest = feedbackByInsightId(feedback);

  const dismissed: SuppressedInsightEntry[] = [];
  const snoozed: SuppressedInsightEntry[] = [];

  for (const row of latest.values()) {
    const liveInsight = byInsight.get(row.insightId);
    const entry: SuppressedInsightEntry = {
      feedback: row,
      insightId: row.insightId,
      title: liveInsight?.title ?? row.title ?? row.insightId,
      pillar: liveInsight?.pillar ?? row.pillar,
      liveInsight,
    };
    if (row.status === 'dismissed') {
      dismissed.push(entry);
    } else if (row.status === 'snoozed' && isInsightSuppressed(row, todayISO)) {
      snoozed.push(entry);
    }
  }

  dismissed.sort((a, b) => b.feedback.updatedAt.localeCompare(a.feedback.updatedAt));
  snoozed.sort((a, b) => b.feedback.updatedAt.localeCompare(a.feedback.updatedAt));

  return {
    active: filterSuppressedInsights(insights, feedback, todayISO),
    dismissed,
    snoozed,
  };
}

/**
 * Surfaces at most one insight per pillar for the compact Overview section,
 * preserving ranking priority.
 */
export function selectOverviewInsights(insights: readonly Insight[], limit = 3): Insight[] {
  if (limit <= 0) return [];
  const seenPillars = new Set<Pillar>();
  const picked: Insight[] = [];
  for (const insight of insights) {
    if (seenPillars.has(insight.pillar)) continue;
    seenPillars.add(insight.pillar);
    picked.push(insight);
    if (picked.length >= limit) break;
  }
  return picked;
}
