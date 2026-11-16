import { z } from "zod";

import type { CreateInput, UpdateInput } from "@/lib/db/repositories";
import { checkinRepository, getCheckinByDate } from "@/lib/db/repositories";
import type { DailyCheckin, ISODate } from "@/types/domain";

const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const checkinFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  mood: ratingSchema,
  stress: ratingSchema,
  energy: ratingSchema,
  concentration: ratingSchema,
  motivation: ratingSchema,
  outdoorMin: z
    .number()
    .int("Whole minutes only.")
    .min(0, "Cannot be negative.")
    .max(1440, "Must be 1440 minutes or less.")
    .optional(),
  note: z.string().max(1000, "Keep notes under 1000 characters.").optional(),
});

export type CheckinFormValues = z.input<typeof checkinFormSchema>;

export interface CheckinUpsertDeps {
  findByDate?: (date: ISODate) => Promise<DailyCheckin | undefined>;
  create?: (input: CreateInput<DailyCheckin>) => Promise<DailyCheckin>;
  update?: (id: string, patch: UpdateInput<DailyCheckin>) => Promise<DailyCheckin>;
}

/**
 * Enforces the one-check-in-per-day contract: updates the existing row for `input.date`
 * when one already exists instead of creating a duplicate.
 */
export async function upsertCheckin(
  input: Omit<DailyCheckin, "id" | "createdAt" | "updatedAt">,
  deps: CheckinUpsertDeps = {},
): Promise<{ record: DailyCheckin; mode: "created" | "updated" }> {
  const findByDate = deps.findByDate ?? getCheckinByDate;
  const create = deps.create ?? checkinRepository.create;
  const update = deps.update ?? checkinRepository.update;

  const existing = await findByDate(input.date);
  if (existing) {
    const record = await update(existing.id, input);
    return { record, mode: "updated" };
  }

  const record = await create(input);
  return { record, mode: "created" };
}
