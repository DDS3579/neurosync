import { getDb } from "@/lib/db/dexie";
import type { DayPlan, ISODate } from "@/types/domain";

import { createRepository } from "./base";

export const dayPlanRepository = createRepository<DayPlan>({
  label: "DayPlan",
  table: () => getDb().dayPlans,
  dateKey: "date",
});

/** Keeps one saved plan per calendar day; returns the stored one for a date, if any. */
export async function getDayPlanByDate(date: ISODate): Promise<DayPlan | undefined> {
  return getDb().dayPlans.where("date").equals(date).first();
}
