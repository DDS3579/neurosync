import { getDb } from "@/lib/db/dexie";
import type { DailyCheckin, ISODate } from "@/types/domain";

import { createRepository } from "./base";

export const checkinRepository = createRepository<DailyCheckin>({
  label: "DailyCheckin",
  table: () => getDb().checkins,
  dateKey: "date",
});

/** The contract keeps one check-in per day; this returns the stored one, if any. */
export async function getCheckinByDate(date: ISODate): Promise<DailyCheckin | undefined> {
  return getDb().checkins.where("date").equals(date).first();
}
