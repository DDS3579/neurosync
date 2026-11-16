import { getDb } from "@/lib/db/dexie";
import type { MovementLog } from "@/types/domain";

import { createRepository } from "./base";

export const movementRepository = createRepository<MovementLog>({
  label: "MovementLog",
  table: () => getDb().movementLogs,
  dateKey: "date",
});
