import { describe, expect, it } from "vitest";

import {
  deriveBrainTimeline,
  deriveWeeklyBrainActivity,
  getRegionImpactContributions,
  hasAnyBrainActivityData,
  rankLoggedActivitiesForImpact,
} from "./brainActivity";

const BANNED_COPY_PATTERNS = [
  /\baffected\b/i,
  /\bimproved\b/i,
  /\bstrengthened\b/i,
  /\bboosted\b/i,
  /\bbrain score\b/i,
  /\bscore\b/i,
  /\bdiagnos/i,
];

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

describe("deriveBrainTimeline, impact rankings, and honesty copy", () => {
  const today = new Date("2026-11-16T12:00:00");

  it("aggregates 7-day and 30-day timelines for both single-day and cumulative modes", () => {
    const timeline7 = deriveBrainTimeline({
      focus: [
        {
          id: "f1",
          createdAt: "2026-11-15T10:00:00.000Z",
          updatedAt: "2026-11-15T10:00:00.000Z",
          date: "2026-11-15",
          startedAt: "2026-11-15T10:00:00.000Z",
          subject: "Neuro",
          method: "active_recall",
          durationMin: 40,
          plannedMin: 40,
          focusRating: 4,
          difficulty: 3,
          distractions: 0,
        },
      ],
      movement: [
        {
          id: "mv1",
          createdAt: "2026-11-16T08:00:00.000Z",
          updatedAt: "2026-11-16T08:00:00.000Z",
          date: "2026-11-16",
          type: "walk",
          durationMin: 25,
          effort: 3,
        },
      ],
      sleep: [],
      habits: [],
      habitLogs: [],
      activities: [
        {
          id: "act-old",
          createdAt: "2026-11-01T10:00:00.000Z",
          updatedAt: "2026-11-01T10:00:00.000Z",
          date: "2026-11-01",
          type: "music",
          durationMin: 50,
          enjoyment: 5,
        },
      ],
      windowDays: 7,
      today,
    });

    expect(timeline7.days).toHaveLength(7);
    expect(timeline7.windowStart).toBe("2026-11-10");
    expect(timeline7.windowEnd).toBe("2026-11-16");

    const day15 = timeline7.days.find((d) => d.date === "2026-11-15")!;
    expect(day15.dayOnly.totalMinutes).toBe(40);
    expect(day15.dayOnly.regionIntensity.hippocampus).toBeGreaterThan(0);

    const day16 = timeline7.days.find((d) => d.date === "2026-11-16")!;
    expect(day16.dayOnly.totalMinutes).toBe(25);
    expect(day16.dayOnly.regionIntensity.hippocampus).toBeUndefined();
    expect(day16.cumulative.totalMinutes).toBe(65);
    expect(day16.cumulative.regionIntensity.hippocampus).toBeGreaterThan(0);
    expect(day16.cumulative.regionIntensity.cerebellum).toBeGreaterThan(0);

    // 30-day window includes the Nov 1 music log
    const timeline30 = deriveBrainTimeline({
      focus: [],
      movement: [],
      sleep: [],
      habits: [],
      habitLogs: [],
      activities: [
        {
          id: "act-old",
          createdAt: "2026-11-01T10:00:00.000Z",
          updatedAt: "2026-11-01T10:00:00.000Z",
          date: "2026-11-01",
          type: "music",
          durationMin: 50,
          enjoyment: 5,
        },
      ],
      windowDays: 30,
      today,
    });
    expect(timeline30.days).toHaveLength(30);
    expect(timeline30.days[29]!.cumulative.totalMinutes).toBe(50);
    expect(timeline30.days[29]!.cumulative.items[0]!.kind).toBe("music");
  });

  it("ranks logged activities by minutes and computes region shares with honest, banned-phrase-free explanations", () => {
    const items = [
      { kind: "exercise" as const, label: "Exercise", minutes: 30, count: 1 },
      { kind: "deep_focus" as const, label: "Deep focus", minutes: 90, count: 2 },
    ];

    const ranked = rankLoggedActivitiesForImpact(items);
    expect(ranked.map((r) => r.kind)).toEqual(["deep_focus", "exercise"]);
    expect(ranked[0]!.regions[0]).toEqual({
      region: "prefrontal",
      regionName: "Prefrontal Cortex",
      weight: 1.0,
    });

    // Parietal involves both deep_focus (90 * 0.7 = 63) and exercise (30 * 0.6 = 18) -> total 81
    const parietalContribs = getRegionImpactContributions("parietal", items);
    expect(parietalContribs).toHaveLength(2);
    expect(parietalContribs[0]!.kind).toBe("deep_focus");
    expect(parietalContribs[0]!.share).toBeCloseTo(63 / 81, 4);
    expect(parietalContribs[1]!.share).toBeCloseTo(18 / 81, 4);

    for (const c of parietalContribs) {
      expect(c.explanation).toContain("commonly associated with");
      expect(c.explanation).toContain("based on what you logged");
      for (const pattern of BANNED_COPY_PATTERNS) {
        expect(c.explanation).not.toMatch(pattern);
      }
    }
  });

  it("handles empty/low-data inputs cleanly and detects whether any user data exists", () => {
    expect(rankLoggedActivitiesForImpact([])).toEqual([]);
    expect(getRegionImpactContributions("amygdala", [])).toEqual([]);
    expect(
      hasAnyBrainActivityData({
        focus: [],
        movement: [],
        sleep: [],
        habits: [],
        habitLogs: [],
        mindfulness: [],
        activities: [],
      }),
    ).toBe(false);

    expect(
      hasAnyBrainActivityData({
        focus: [],
        movement: [],
        sleep: [],
        habits: [],
        habitLogs: [{ id: "h1", habitId: "x", date: "2026-11-16", done: true, createdAt: "", updatedAt: "" }],
      }),
    ).toBe(true);
  });
});
