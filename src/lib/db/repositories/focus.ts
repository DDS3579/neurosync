import { getDb } from "@/lib/db/dexie";
import type { FocusSession } from "@/types/domain";

import { createRepository } from "./base";

export const focusRepository = createRepository<FocusSession>({
  label: "FocusSession",
  table: () => getDb().focusSessions,
  dateKey: "date",
});
