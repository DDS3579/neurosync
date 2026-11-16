import { getDb } from "@/lib/db/dexie";
import type { SleepLog } from "@/types/domain";

import { createRepository } from "./base";

export const sleepRepository = createRepository<SleepLog>({
  label: "SleepLog",
  table: () => getDb().sleepLogs,
  dateKey: "date",
});
