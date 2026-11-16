import { describe, expect, it } from "vitest";

import type { FocusSession } from "@/types/domain";
import { summarizeMethodStats } from "./focusAnalytics";

const makeSession = (
  id: string,
  method: FocusSession["method"],
  durationMin: number,
  focusRating: FocusSession["focusRating"],
  difficulty: FocusSession["difficulty"],
): FocusSession => ({
  id,
  createdAt: "2026-11-16T08:00:00.000Z",
  updatedAt: "2026-11-16T08:00:00.000Z",
  date: "2026-11-16",
  startedAt: "2026-11-16T08:00:00",
  durationMin,
  plannedMin: durationMin,
  subject: "Test",
  method,
  focusRating,
  difficulty,
  distractions: 0,
});

describe("summarizeMethodStats", () => {
  it("computes counts, total minutes, average focus, and average difficulty per method", () => {
    const stats = summarizeMethodStats([
      makeSession("1", "active_recall", 25, 4, 3),
      makeSession("2", "active_recall", 35, 5, 4),
      makeSession("3", "deep_reading", 50, 3, 2),
    ]);

    const recall = stats.find((s) => s.method === "active_recall");
    expect(recall).toMatchObject({
      sessionCount: 2,
      totalMinutes: 60,
      avgFocus: 4.5,
      avgDifficulty: 3.5,
      libraryHref: "/library#active-recall",
    });

    const reading = stats.find((s) => s.method === "deep_reading");
    expect(reading).toMatchObject({
      sessionCount: 1,
      totalMinutes: 50,
      avgFocus: 3,
      avgDifficulty: 2,
    });

    const teaching = stats.find((s) => s.method === "teaching");
    expect(teaching).toMatchObject({
      sessionCount: 0,
      totalMinutes: 0,
      avgFocus: null,
      avgDifficulty: null,
    });
  });

  it("keeps fixed learning-method order regardless of averages", () => {
    const stats = summarizeMethodStats([
      makeSession("1", "teaching", 30, 5, 2),
      makeSession("2", "active_recall", 30, 2, 5),
    ]);
    expect(stats.map((s) => s.method)).toEqual([
      "active_recall",
      "spaced_repetition",
      "problem_solving",
      "deep_reading",
      "skill_practice",
      "teaching",
    ]);
  });
});
