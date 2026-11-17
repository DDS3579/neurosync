import { getDb } from "@/lib/db/dexie";
import type { MindfulnessSession } from "@/types/domain";

import { createRepository } from "./base";

export const mindfulnessRepository = createRepository<MindfulnessSession>({
  label: "MindfulnessSession",
  table: () => getDb().mindfulnessSessions,
  dateKey: "date",
});
