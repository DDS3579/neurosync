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
});
