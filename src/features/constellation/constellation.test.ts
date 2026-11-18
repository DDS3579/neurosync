import { describe, expect, it } from "vitest";

import { generateDemoData } from "@/lib/insights";
import {
  CONSTELLATION_CAVEAT,
  CONSTELLATION_VIEWBOX,
  MIN_CONSTELLATION_DAYS,
  MIN_SHARED_DAYS,
  computeDeterministicConstellationLayout,
  deriveConstellation,
  formatSameDayCount,
  getCoOccurrencesForNode,
} from "./constellation";
import type {
  ActivityLog,
  FocusSession,
  Habit,
  HabitLog,
  MindfulnessSession,
  MovementLog,
} from "@/types/domain";

const BANNED_COPY_PATTERNS = [
  /\bcaus(e|ed|es|ing)\b/i,
  /\bmakes you\b/i,
  /\bleads to\b/i,
  /\bresults in\b/i,
  /\baffected\b/i,
  /\bimproved\b/i,
  /\bstrengthened\b/i,
  /\bboosted\b/i,
  /\bstreak/i,
  /\bbroken\b/i,
  /\bscore\b/i,
  /\bdiagnos/i,
];

function makeHabit(id: string, name: string, archived = false): Habit {
  return {
    id,
    name,
    archived,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  };
}

function makeHabitLog(id: string, habitId: string, date: string, done = true): HabitLog {
  return {
    id,
    habitId,
    date,
    done,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  };
}

function makeActivity(
  id: string,
  type: ActivityLog["type"],
  date: string,
): ActivityLog {
  return {
    id,
    date,
    type,
    durationMin: 30,
    enjoyment: 4,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

function makeFocus(
  id: string,
  method: FocusSession["method"],
  date: string,
): FocusSession {
  return {
    id,
    date,
    startedAt: `${date}T09:00:00.000Z`,
    durationMin: 25,
    plannedMin: 25,
    subject: "Neuro",
    method,
    focusRating: 4,
    difficulty: 3,
    distractions: 0,
    createdAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T09:00:00.000Z`,
  };
}

function makeMovement(
  id: string,
  type: MovementLog["type"],
  date: string,
): MovementLog {
  return {
    id,
    date,
    type,
    durationMin: 25,
    effort: 3,
    createdAt: `${date}T17:00:00.000Z`,
    updatedAt: `${date}T17:00:00.000Z`,
  };
}

function makeMindfulness(
  id: string,
  type: MindfulnessSession["type"],
  date: string,
): MindfulnessSession {
  return {
    id,
    date,
    type,
    durationMin: 5,
    createdAt: `${date}T07:00:00.000Z`,
    updatedAt: `${date}T07:00:00.000Z`,
  };
}

describe("deriveConstellation", () => {
  const today = new Date("2026-11-17T12:00:00");

  it("gates graph output until the user has at least 10 active days in the window", () => {
    const nineDays = Array.from({ length: 9 }, (_, i) => `2026-11-0${i + 1}`);
    const belowGate = deriveConstellation({
      habits: [makeHabit("h1", "Reading")],
      habitLogs: nineDays.map((d, i) => makeHabitLog(`hl-${i}`, "h1", d)),
      activities: nineDays.map((d, i) => makeActivity(`a-${i}`, "music", d)),
      focus: [],
      movement: [],
      mindfulness: [],
      windowDays: 30,
      today,
    });

    expect(belowGate.minDaysRequired).toBe(MIN_CONSTELLATION_DAYS);
    expect(belowGate.activeDaysCount).toBe(9);
    expect(belowGate.meetsMinDays).toBe(false);
    expect(belowGate.hasAnyData).toBe(true);
    expect(belowGate.nodes).toEqual([]);
    expect(belowGate.edges).toEqual([]);
    expect(belowGate.summaryText).toContain("at least 10 logged days");
  });

  it("deduplicates multiple logs on the same day and applies the >= 3 shared days edge threshold", () => {
    // 10 distinct active days: Nov 08 .. Nov 17
    const days = Array.from({ length: 10 }, (_, i) =>
      `2026-11-${String(8 + i).padStart(2, "0")}`,
    );

    const data = deriveConstellation({
      habits: [
        makeHabit("h1", "Reading"),
        makeHabit("h-arch", "Archived habit", true),
      ],
      habitLogs: [
        // Reading done on days 0..4 (5 days)
        ...days.slice(0, 5).map((d, i) => makeHabitLog(`hl-r-${i}`, "h1", d, true)),
        // False log should be ignored
        makeHabitLog("hl-false", "h1", days[9]!, false),
        // Archived habit done every day -> must be ignored
        ...days.map((d, i) => makeHabitLog(`hl-arch-${i}`, "h-arch", d, true)),
      ],
      activities: [
        // Music logged TWICE on day 0 and once on days 1, 2 -> 3 distinct days, 3 shared days with Reading
        makeActivity("a1", "music", days[0]!),
        makeActivity("a2", "music", days[0]!),
        makeActivity("a3", "music", days[1]!),
        makeActivity("a4", "music", days[2]!),
        // Novelty logged only on days 0 and 1 -> 2 shared days (< 3, no edge!)
        makeActivity("a5", "novelty", days[0]!),
        makeActivity("a6", "novelty", days[1]!),
      ],
      focus: [
        // Active recall logged multiple times on day 0 + days 5..9 -> 6 distinct days
        makeFocus("f0a", "active_recall", days[0]!),
        makeFocus("f0b", "active_recall", days[0]!),
        ...days.slice(5, 10).map((d, i) => makeFocus(`f-${i}`, "active_recall", d)),
      ],
      movement: [makeMovement("mv0", "walk", days[0]!)],
      mindfulness: [makeMindfulness("mn0", "box_breathing", days[0]!)],
      windowDays: 14,
      today,
    });

    expect(data.meetsMinDays).toBe(true);
    expect(data.activeDaysCount).toBe(10);

    // Archived habit excluded
    expect(data.nodes.find((n) => n.id === "habit:h-arch")).toBeUndefined();

    // Music logged twice on day 0 still counts as 3 days total
    const musicNode = data.nodes.find((n) => n.id === "activity:music");
    expect(musicNode?.daysPresent).toBe(3);

    const readingNode = data.nodes.find((n) => n.id === "habit:h1");
    expect(readingNode?.daysPresent).toBe(5);

    const recallNode = data.nodes.find((n) => n.id === "method:active_recall");
    expect(recallNode?.daysPresent).toBe(6);

    // Edge between habit:h1 and activity:music has sharedDays = 3 (passes >= 3 gate)
    const musicReadingEdge = data.edges.find(
      (e) =>
        (e.source === "activity:music" && e.target === "habit:h1") ||
        (e.source === "habit:h1" && e.target === "activity:music"),
    );
    expect(musicReadingEdge).toBeDefined();
    expect(musicReadingEdge?.sharedDays).toBe(MIN_SHARED_DAYS);

    // Novelty only shared 2 days with anything -> zero edges for novelty
    const noveltyEdges = data.edges.filter(
      (e) => e.source === "activity:novelty" || e.target === "activity:novelty",
    );
    expect(noveltyEdges).toHaveLength(0);
  });

  it("filters records accurately by 14 / 30 / 90 day windows", () => {
    const recent10 = Array.from({ length: 10 }, (_, i) =>
      `2026-11-${String(8 + i).padStart(2, "0")}`,
    );
    const old25 = "2026-10-25"; // 23 days before Nov 17 -> outside 14d, inside 30d
    const old60 = "2026-09-20"; // 58 days before Nov 17 -> outside 30d, inside 90d

    const baseInput = {
      habits: [makeHabit("h1", "Meditation")],
      habitLogs: [
        ...recent10.map((d, i) => makeHabitLog(`r-${i}`, "h1", d)),
        makeHabitLog("old25", "h1", old25),
        makeHabitLog("old60", "h1", old60),
      ],
      activities: [],
      focus: [],
      movement: [],
      mindfulness: [],
      today,
    };

    const w14 = deriveConstellation({ ...baseInput, windowDays: 14 });
    const w30 = deriveConstellation({ ...baseInput, windowDays: 30 });
    const w90 = deriveConstellation({ ...baseInput, windowDays: 90 });

    expect(w14.nodes[0]?.daysPresent).toBe(10);
    expect(w30.nodes[0]?.daysPresent).toBe(11);
    expect(w90.nodes[0]?.daysPresent).toBe(12);
  });

  it("computes deterministic settled positions independent of input order", () => {
    const nodesA = [
      { id: "habit:h1", radius: 12 },
      { id: "activity:music", radius: 8 },
      { id: "method:active_recall", radius: 10 },
      { id: "movement:walk", radius: 9 },
    ];
    const edgesA = [
      { source: "activity:music", target: "habit:h1", sharedDays: 5 },
      { source: "habit:h1", target: "method:active_recall", sharedDays: 3 },
    ];

    const pos1 = computeDeterministicConstellationLayout(nodesA, edgesA);
    const pos2 = computeDeterministicConstellationLayout([...nodesA].reverse(), [...edgesA].reverse());

    for (const node of nodesA) {
      const p1 = pos1.get(node.id)!;
      const p2 = pos2.get(node.id)!;
      expect(p1).toEqual(p2);
      expect(p1.x).toBeGreaterThanOrEqual(CONSTELLATION_VIEWBOX.padding);
      expect(p1.x).toBeLessThanOrEqual(
        CONSTELLATION_VIEWBOX.width - CONSTELLATION_VIEWBOX.padding,
      );
      expect(p1.y).toBeGreaterThanOrEqual(CONSTELLATION_VIEWBOX.padding);
      expect(p1.y).toBeLessThanOrEqual(
        CONSTELLATION_VIEWBOX.height - CONSTELLATION_VIEWBOX.padding,
      );
    }
  });

  it("works with generateDemoData and keeps all copy strictly descriptive", () => {
    const demo = generateDemoData(14, 42, today);
    const result = deriveConstellation({
      habits: demo.habits,
      habitLogs: demo.habitLogs,
      activities: [],
      focus: demo.focus,
      movement: demo.movement,
      mindfulness: [],
      windowDays: 30,
      today,
    });

    expect(result.meetsMinDays).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(2);
    expect(result.edges.length).toBeGreaterThan(0);

    const sampleTexts = [
      CONSTELLATION_CAVEAT,
      result.summaryText,
      formatSameDayCount(4),
      ...result.nodes.flatMap((n) =>
        getCoOccurrencesForNode(n.id, result.nodes, result.edges, 3).map((c) => c.description),
      ),
    ];

    for (const text of sampleTexts) {
      for (const pattern of BANNED_COPY_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    }
  });
});
