import { getDb } from "@/lib/db/dexie";
import type { ReviewItem } from "@/types/domain";

import { createRepository } from "./base";

export const reviewRepository = createRepository<ReviewItem>({
  label: "ReviewItem",
  table: () => getDb().reviewItems,
  dateKey: "nextReviewDate",
});
