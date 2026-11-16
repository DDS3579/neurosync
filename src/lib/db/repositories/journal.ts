import { getDb } from "@/lib/db/dexie";
import type { JournalEntry } from "@/types/domain";

import { createRepository } from "./base";

export const journalRepository = createRepository<JournalEntry>({
  label: "JournalEntry",
  table: () => getDb().journalEntries,
  dateKey: "date",
});
