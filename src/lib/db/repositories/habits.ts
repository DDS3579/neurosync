import { getDb } from "@/lib/db/dexie";
import type { Habit } from "@/types/domain";

import { createRepository } from "./base";

export const habitRepository = createRepository<Habit>({
  label: "Habit",
  table: () => getDb().habits,
});
