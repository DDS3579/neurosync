import { getDb } from "@/lib/db/dexie";
import type { NutritionLog } from "@/types/domain";

import { createRepository } from "./base";

export const nutritionRepository = createRepository<NutritionLog>({
  label: "NutritionLog",
  table: () => getDb().nutritionLogs,
  dateKey: "date",
});
