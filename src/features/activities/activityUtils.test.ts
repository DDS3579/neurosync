import { describe, expect, it } from "vitest";

import type { ActivityLog } from "@/types/domain";
import {
  PERSONAL_ACTIVITY_OPTIONS,
  activityFormSchema,
  sortActivityLogs,
  summarizeWeeklyActivityVariety,
} from "./activityUtils";

const makeLog = (id: string, date: string, type: ActivityLog["type"], durationMin = 30): ActivityLog => ({
  id,
  createdAt: `${date}T10:00:00.000Z`,
  updatedAt: `${date}T10:00:00.000Z`,
  date,
  type,
  durationMin,
  enjoyment: 4,
});

describe("summarizeWeeklyActivityVariety", () => {
  it("counts distinct types and minutes inside the 7-day window", () => {
    const today = new Date("2026-11-16T12:00:00");
    const summary = summarizeWeeklyActivityVariety(
      [
        makeLog("1", "2026-11-16", "social", 45),
        makeLog("2", "2026-11-15", "creative", 30),
        makeLog("3", "2026-11-14", "social", 15),
        makeLog("4", "2026-11-10", "novelty", 20),
        makeLog("5", "2026-11-09", "music", 60), // 8 days ago -> outside 7-day window
      ],
      today,
    );

    expect(summary.windowStart).toBe("2026-11-10");
    expect(summary.windowEnd).toBe("2026-11-16");
    expect(summary.distinctTypesCount).toBe(3);
    expect(summary.totalLogs).toBe(4);
    expect(summary.totalMinutes).toBe(110);
    expect(summary.byType.map((entry) => entry.type)).toEqual(["social", "creative", "novelty"]);
  });

  it("returns empty summary when no logs exist", () => {
    const summary = summarizeWeeklyActivityVariety([], new Date("2026-11-16T12:00:00"));
    expect(summary.distinctTypesCount).toBe(0);
    expect(summary.totalLogs).toBe(0);
    expect(summary.byType).toEqual([]);
  });
});

describe("activityFormSchema and sortActivityLogs", () => {
  it("validates all 7 personal activity types and enjoyment range", () => {
    expect(PERSONAL_ACTIVITY_OPTIONS).toHaveLength(7);
    expect(
      activityFormSchema.safeParse({
        date: "2026-11-16",
        type: "puzzles_games",
        durationMin: 25,
        enjoyment: 5,
        note: "Crossword with morning tea",
      }).success,
    ).toBe(true);

    expect(
      activityFormSchema.safeParse({
        date: "2026-11-16",
        type: "puzzles_games",
        durationMin: 0,
        enjoyment: 4,
      }).success,
    ).toBe(false);
  });

  it("sorts activity logs newest-first", () => {
    const sorted = sortActivityLogs([
      makeLog("old", "2026-11-12", "music"),
      makeLog("new", "2026-11-16", "new_hobby"),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
