import { describe, expect, it } from "vitest";

import type { ReviewItem } from "@/types/domain";
import {
  REVIEW_INTERVAL_DAYS,
  createInitialReviewSchedule,
  isReviewDue,
  partitionReviewQueue,
  scheduleNextReview,
} from "./reviewScheduler";

const makeItem = (id: string, nextReviewDate: string, intervalStep = 0, reviewCount = 0): ReviewItem => ({
  id,
  createdAt: "2026-11-01T08:00:00.000Z",
  updatedAt: "2026-11-01T08:00:00.000Z",
  topic: `Topic ${id}`,
  intervalStep,
  nextReviewDate,
  reviewCount,
});

describe("reviewScheduler", () => {
  it("starts new topics at step 0 (1 day)", () => {
    expect(REVIEW_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30]);
    expect(createInitialReviewSchedule("2026-11-16")).toEqual({
      intervalStep: 0,
      nextReviewDate: "2026-11-17",
      reviewCount: 0,
    });
  });

  it("advances on easy, repeats on okay, and steps back on hard", () => {
    const today = "2026-11-16";

    const easy0 = scheduleNextReview({ intervalStep: 0, reviewCount: 0 }, "easy", today);
    expect(easy0).toEqual({
      intervalStep: 1,
      intervalDays: 3,
      nextReviewDate: "2026-11-19",
      lastReviewedDate: today,
      reviewCount: 1,
    });

    const okay2 = scheduleNextReview({ intervalStep: 2, reviewCount: 2 }, "okay", today);
    expect(okay2).toEqual({
      intervalStep: 2,
      intervalDays: 7,
      nextReviewDate: "2026-11-23",
      lastReviewedDate: today,
      reviewCount: 3,
    });

    const hard2 = scheduleNextReview({ intervalStep: 2, reviewCount: 2 }, "hard", today);
    expect(hard2).toEqual({
      intervalStep: 1,
      intervalDays: 3,
      nextReviewDate: "2026-11-19",
      lastReviewedDate: today,
      reviewCount: 3,
    });
  });

  it("clamps step bounds at 0 and 4", () => {
    const today = "2026-11-16";
    expect(scheduleNextReview({ intervalStep: 0, reviewCount: 1 }, "hard", today)).toMatchObject({
      intervalStep: 0,
      intervalDays: 1,
      nextReviewDate: "2026-11-17",
    });

    expect(scheduleNextReview({ intervalStep: 4, reviewCount: 5 }, "easy", today)).toMatchObject({
      intervalStep: 4,
      intervalDays: 30,
      nextReviewDate: "2026-12-16",
    });
  });

  it("partitions due today vs upcoming sorted chronologically", () => {
    const today = "2026-11-16";
    const items = [
      makeItem("c", "2026-11-18", 1),
      makeItem("a", "2026-11-16", 0),
      makeItem("b", "2026-11-14", 2),
      makeItem("d", "2026-11-17", 0),
    ];

    expect(isReviewDue(items[0]!, today)).toBe(false);
    expect(isReviewDue(items[1]!, today)).toBe(true);
    expect(isReviewDue(items[2]!, today)).toBe(true);

    const { due, upcoming } = partitionReviewQueue(items, today);
    expect(due.map((i) => i.id)).toEqual(["b", "a"]);
    expect(upcoming.map((i) => i.id)).toEqual(["d", "c"]);
  });
});
