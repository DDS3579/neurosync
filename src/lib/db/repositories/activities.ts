import { getDb } from "@/lib/db/dexie";
import type { ActivityLog } from "@/types/domain";

import { createRepository } from "./base";

export const activityRepository = createRepository<ActivityLog>({
  label: "ActivityLog",
  table: () => getDb().activityLogs,
  dateKey: "date",
});
