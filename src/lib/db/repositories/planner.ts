import { getDb } from "@/lib/db/dexie";
import type { DayPlan, DayPlanMeta, ISODate } from "@/types/domain";

import { createRepository } from "./base";

export const dayPlanRepository = createRepository<DayPlan>({
  label: "DayPlan",
  table: () => getDb().dayPlans,
  dateKey: "date",
});

export const dayPlanRepo = dayPlanRepository;

/** Keeps one saved plan per calendar day; returns the stored one for a date, if any. */
export async function getDayPlanByDate(date: ISODate): Promise<DayPlan | undefined> {
  return getDb().dayPlans.where("date").equals(date).first();
}

const metaBase = createRepository<DayPlanMeta>({
  label: "DayPlanMeta",
  table: () => getDb().dayPlanMeta,
  dateKey: "date",
});

/** Standalone so callers can destructure or pass these as callbacks safely. */
async function upsertDayPlanMeta(
  date: ISODate,
  patch: { shutdownDone?: boolean; reflection?: string },
): Promise<DayPlanMeta> {
  const db = getDb();
  return db.transaction("rw", db.dayPlanMeta, async () => {
    const existing = await db.dayPlanMeta.where("date").equals(date).first();
    if (existing) {
      return metaBase.update(existing.id, {
        shutdownDone: patch.shutdownDone ?? existing.shutdownDone,
        reflection: patch.reflection !== undefined ? patch.reflection : existing.reflection,
      });
    }
    return metaBase.create({
      date,
      shutdownDone: patch.shutdownDone ?? false,
      reflection: patch.reflection,
    });
  });
}

export const dayPlanMetaRepository = {
  ...metaBase,

  async getByDate(date: ISODate): Promise<DayPlanMeta | undefined> {
    return getDb().dayPlanMeta.where("date").equals(date).first();
  },

  upsertForDate: upsertDayPlanMeta,

  setShutdownDone(date: ISODate, shutdownDone: boolean, reflection?: string): Promise<DayPlanMeta> {
    return upsertDayPlanMeta(date, { shutdownDone, reflection });
  },
};

export const dayPlanMetaRepo = dayPlanMetaRepository;
