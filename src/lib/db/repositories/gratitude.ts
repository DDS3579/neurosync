import { getDb } from "@/lib/db/dexie";
import type { GratitudeEntry, ISODate } from "@/types/domain";

import { createRepository } from "./base";

export const gratitudeRepository = createRepository<GratitudeEntry>({
  label: "GratitudeEntry",
  table: () => getDb().gratitudeEntries,
  dateKey: "date",
});

/** Keeps one gratitude entry per day; returns the stored one for a date, if any. */
export async function getGratitudeByDate(date: ISODate): Promise<GratitudeEntry | undefined> {
  return getDb().gratitudeEntries.where("date").equals(date).first();
}
