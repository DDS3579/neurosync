import { getDb } from "@/lib/db/dexie";
import type { MicrotaskResult } from "@/types/domain";

import { createRepository } from "./base";

export const microtaskRepository = createRepository<MicrotaskResult>({
  label: "MicrotaskResult",
  table: () => getDb().microtaskResults,
  dateKey: "date",
});
