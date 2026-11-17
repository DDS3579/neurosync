import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

import type { ISODate, ReviewDifficulty, ReviewItem } from "@/types/domain";

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export function addDaysISO(dateISO: ISODate, days: number): ISODate {
  return format(addDays(parseISO(dateISO), days), "yyyy-MM-dd");
}

function clampIntervalStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(REVIEW_INTERVAL_DAYS.length - 1, Math.trunc(step)));
}

export function intervalDaysForStep(step: number): number {
  return REVIEW_INTERVAL_DAYS[clampIntervalStep(step)] ?? 1;
}

export function createInitialReviewSchedule(todayISO: ISODate): {
  intervalStep: number;
  nextReviewDate: ISODate;
  reviewCount: number;
} {
  return {
    intervalStep: 0,
    nextReviewDate: addDaysISO(todayISO, REVIEW_INTERVAL_DAYS[0]),
    reviewCount: 0,
  };
}

/**
 * Computes the next fixed-interval review step:
 * - "easy": advances one interval (up to 30 days)
 * - "okay": repeats the current interval
 * - "hard": steps back one interval (down to 1 day)
 */
export function scheduleNextReview(
  item: Pick<ReviewItem, "intervalStep" | "reviewCount">,
  rating: ReviewDifficulty,
  todayISO: ISODate,
): {
  intervalStep: number;
  intervalDays: number;
  nextReviewDate: ISODate;
  lastReviewedDate: ISODate;
  reviewCount: number;
} {
  const currentStep = clampIntervalStep(item.intervalStep);
  const nextStep =
    rating === "easy"
      ? clampIntervalStep(currentStep + 1)
      : rating === "hard"
        ? clampIntervalStep(currentStep - 1)
        : currentStep;

  const intervalDays = intervalDaysForStep(nextStep);
  return {
    intervalStep: nextStep,
    intervalDays,
    nextReviewDate: addDaysISO(todayISO, intervalDays),
    lastReviewedDate: todayISO,
    reviewCount: Math.max(0, item.reviewCount) + 1,
  };
}

export function isReviewDue(item: Pick<ReviewItem, "nextReviewDate">, todayISO: ISODate): boolean {
  return item.nextReviewDate <= todayISO;
}

export function partitionReviewQueue(
  items: readonly ReviewItem[],
  todayISO: ISODate,
): { due: ReviewItem[]; upcoming: ReviewItem[] } {
  const due: ReviewItem[] = [];
  const upcoming: ReviewItem[] = [];

  for (const item of items) {
    if (isReviewDue(item, todayISO)) {
      due.push(item);
    } else {
      upcoming.push(item);
    }
  }

  const byDateThenTopic = (a: ReviewItem, b: ReviewItem) => {
    const byDate = a.nextReviewDate.localeCompare(b.nextReviewDate);
    return byDate !== 0 ? byDate : a.topic.localeCompare(b.topic);
  };

  due.sort(byDateThenTopic);
  upcoming.sort(byDateThenTopic);

  return { due, upcoming };
}

export const reviewItemFormSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, "Enter a topic to review.")
    .max(120, "Keep the topic under 120 characters."),
  notes: z.string().trim().max(240, "Keep notes under 240 characters.").optional(),
});

export type ReviewItemFormValues = z.input<typeof reviewItemFormSchema>;
