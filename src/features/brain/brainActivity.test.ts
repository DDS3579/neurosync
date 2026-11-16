import { describe, expect, it } from "vitest";

import { deriveWeeklyBrainActivity } from "./brainActivity";

describe("deriveWeeklyBrainActivity", () => {
  it("feeds MindfulnessSession records through the mindfulness activity kind", () => {
    const result = deriveWeeklyBrainActivity({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      mindfulness: [
        {
          id: "m1",
          createdAt: "2026-11-16T08:00:00.000Z",
          updatedAt: "2026-11-16T08:00:00.000Z",
          date: "2026-11-16",
          type: "box_breathing",
          durationMin: 5,
        },
        {
          id: "m2",
          createdAt: "2026-11-15T08:00:00.000Z",
          updatedAt: "2026-11-15T08:00:00.000Z",
          date: "2026-11-15",
          type: "meditation",
          durationMin: 10,
        },
      ],
      today: new Date("2026-11-16T12:00:00"),
    });

    expect(result.items).toEqual([
      {
        kind: "mindfulness",
        label: "Mindfulness",
        minutes: 15,
        count: 2,
      },
    ]);
    expect(result.activity.prefrontal).toBeGreaterThan(0);
    expect(result.activity.amygdala).toBeGreaterThan(0);
  });

  it("excludes mindfulness sessions outside the 7-day window", () => {
    const result = deriveWeeklyBrainActivity({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      mindfulness: [
        {
          id: "m-old",
          createdAt: "2026-11-01T08:00:00.000Z",
          updatedAt: "2026-11-01T08:00:00.000Z",
          date: "2026-11-01",
          type: "4_7_8_breathing",
          durationMin: 5,
        },
      ],
      today: new Date("2026-11-16T12:00:00"),
    });

    expect(result.items).toEqual([]);
    expect(result.activity).toEqual({});
  });

  it("feeds ActivityLog entries into activityToRegionIntensity using their ActivityKind", () => {
    const result = deriveWeeklyBrainActivity({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      activities: [
        {
          id: "a1",
          createdAt: "2026-11-16T10:00:00.000Z",
          updatedAt: "2026-11-16T10:00:00.000Z",
          date: "2026-11-16",
          type: "puzzles_games",
          durationMin: 30,
          enjoyment: 4,
        },
        {
          id: "a2",
          createdAt: "2026-11-15T10:00:00.000Z",
          updatedAt: "2026-11-15T10:00:00.000Z",
          date: "2026-11-15",
          type: "novelty",
          durationMin: 40,
          enjoyment: 5,
        },
        {
          id: "a3",
          createdAt: "2026-11-14T10:00:00.000Z",
          updatedAt: "2026-11-14T10:00:00.000Z",
          date: "2026-11-14",
          type: "new_hobby",
          durationMin: 20,
          enjoyment: 4,
        },
      ],
      today: new Date("2026-11-16T12:00:00"),
    });

    expect(result.items.map((i) => i.kind).sort()).toEqual([
      "new_hobby",
      "novelty",
      "puzzles_games",
    ]);
    expect(result.activity.prefrontal).toBeGreaterThan(0);
    expect(result.activity.hippocampus).toBeGreaterThan(0);
    expect(result.activity.cerebellum).toBeGreaterThan(0);
    expect(result.activity.amygdala).toBeGreaterThan(0);
  });
});
