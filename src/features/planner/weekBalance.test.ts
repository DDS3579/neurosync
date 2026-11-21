import { describe, expect, it } from "vitest";

import { buildWeekBalance, weekStartFor } from "./weekBalance";
import type { Block, Task, UserSettings } from "@/types/domain";

const settings = {
  sleepTargetMin: 480,
  deepWorkCapMin: 240,
  snapMin: 15,
} as Pick<UserSettings, "sleepTargetMin" | "deepWorkCapMin" | "snapMin">;

const task = {
  id: "t1",
  createdAt: "2026-11-16T08:00:00.000Z",
  updatedAt: "2026-11-16T08:00:00.000Z",
  title: "Chapter",
  kind: "deep",
  estimateMin: 300,
  status: "active",
} as Task;

const block = (id: string, over: Partial<Block> = {}): Block => ({
  id,
  createdAt: "2026-11-16T08:00:00.000Z",
  updatedAt: "2026-11-16T08:00:00.000Z",
  taskId: "t1",
  order: 0,
  plannedMin: 50,
  status: "scheduled",
  plannedDate: "2026-11-16",
  plannedStart: "09:00",
  ...over,
});

describe("week balance", () => {
  it("anchors the week on Monday", () => {
    expect(weekStartFor("2026-11-19")).toBe("2026-11-16");
    expect(weekStartFor("2026-11-16")).toBe("2026-11-16");
    expect(weekStartFor("2026-11-22")).toBe("2026-11-16");
  });

  it("reports seven days with available vs planned minutes", () => {
    const week = buildWeekBalance({
      startISO: "2026-11-19",
      blocks: [block("b1"), block("b2", { plannedMin: 60, plannedStart: "10:00" })],
      tasks: [task],
      settings,
    });
    expect(week.days).toHaveLength(7);
    expect(week.start).toBe("2026-11-16");
    const monday = week.days[0]!;
    expect(monday.date).toBe("2026-11-16");
    expect(monday.plannedMin).toBe(110);
    expect(monday.availableMin).toBe(915);
    expect(monday.status).toBe("clear");
    expect(monday.doneCount).toBe(0);
    expect(week.plannedMin).toBe(110);
    expect(week.overDays).toBe(0);
  });

  it("flags an overpacked day without scoring language", () => {
    const week = buildWeekBalance({
      startISO: "2026-11-16",
      blocks: [block("heavy", { plannedMin: 960 })],
      tasks: [task],
      settings,
    });
    const day = week.days[0]!;
    expect(day.status).toBe("over");
    expect(day.deltaMin).toBe(-45);
    expect(day.suggestion).toMatch(/more planned than the open window/i);
    expect(week.suggestions.join(" ")).not.toMatch(/\bscore|productivity|fail|behind\b/i);
  });

  it("ignores skipped blocks and empty days", () => {
    const week = buildWeekBalance({
      startISO: "2026-11-16",
      blocks: [block("skip", { status: "skipped", plannedMin: 300 })],
      tasks: [task],
      settings,
    });
    expect(week.days[0]!.status).toBe("empty");
    expect(week.days[0]!.plannedMin).toBe(0);
    expect(week.suggestions.join(" ")).toMatch(/No blocks are placed this week/i);
  });

  it("subtracts fixed commitments from the available window", () => {
    const week = buildWeekBalance({
      startISO: "2026-11-16",
      blocks: [],
      tasks: [task],
      plans: [
        {
          id: "p1",
          createdAt: "2026-11-16T08:00:00.000Z",
          updatedAt: "2026-11-16T08:00:00.000Z",
          date: "2026-11-17",
          wakeTime: "07:00",
          sleepTargetMin: 480,
          windDownMin: 45,
          maxStudyBlockMin: 50,
          breakMin: 10,
          bufferMin: 10,
          movementGoalMin: 30,
          preferRecoverySpacing: true,
          commitments: [{ id: "c1", title: "Classes", startTime: "09:00", endTime: "12:00" }],
          studyGoals: [],
          blocks: [],
          unscheduled: [],
        },
      ],
      settings,
    });
    expect(week.days[1]!.availableMin).toBe(735);
  });
});
