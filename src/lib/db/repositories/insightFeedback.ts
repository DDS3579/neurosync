import { getDb } from "@/lib/db/dexie";
import { SNOOZE_DAYS, computeSnoozeUntil } from "@/lib/insights/feedback";
import type { ISODate, InsightFeedback, Pillar } from "@/types/domain";
import { createRepository } from "./base";

const base = createRepository<InsightFeedback>({
  table: () => getDb().insightFeedback,
  label: "insightFeedback",
});

async function upsertByInsightId(
  payload: Omit<InsightFeedback, "id" | "createdAt" | "updatedAt">,
): Promise<InsightFeedback> {
  const table = getDb().insightFeedback;
  const existing = await table.where("insightId").equals(payload.insightId).first();
  if (existing) {
    return base.update(existing.id, payload);
  }
  return base.create({
    id: payload.insightId,
    ...payload,
  });
}

export const insightFeedbackRepository = {
  ...base,

  dismiss(insight: { id: string; title?: string; pillar?: Pillar }): Promise<InsightFeedback> {
    return upsertByInsightId({
      insightId: insight.id,
      status: "dismissed",
      snoozeUntil: undefined,
      title: insight.title,
      pillar: insight.pillar,
    });
  },

  snooze(
    insight: { id: string; title?: string; pillar?: Pillar },
    todayISO: ISODate,
    days: number = SNOOZE_DAYS,
  ): Promise<InsightFeedback> {
    return upsertByInsightId({
      insightId: insight.id,
      status: "snoozed",
      snoozeUntil: computeSnoozeUntil(todayISO, days),
      title: insight.title,
      pillar: insight.pillar,
    });
  },

  async restore(insightId: string): Promise<void> {
    const table = getDb().insightFeedback;
    const matches = await table.where("insightId").equals(insightId).toArray();
    if (matches.length > 0) {
      await Promise.all(matches.map((m) => base.remove(m.id)));
      return;
    }
    await base.remove(insightId);
  },
};
