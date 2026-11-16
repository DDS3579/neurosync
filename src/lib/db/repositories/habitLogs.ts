import { getDb } from "@/lib/db/dexie";
import type { HabitLog } from "@/types/domain";

import { createRepository } from "./base";

export const habitLogRepository = createRepository<HabitLog>({
  label: "HabitLog",
  table: () => getDb().habitLogs,
  dateKey: "date",
});
