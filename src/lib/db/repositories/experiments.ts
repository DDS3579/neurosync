import { getDb } from "@/lib/db/dexie";
import type { Experiment } from "@/types/domain";

import { createRepository } from "./base";

export const experimentRepository = createRepository<Experiment>({
  label: "Experiment",
  table: () => getDb().experiments,
});
