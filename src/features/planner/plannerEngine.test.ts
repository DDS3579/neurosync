import { describe, expect, it } from "vitest";

import type { FocusSession } from "@/types/domain";
import {
  computePlanBalance,
  generateDayPlan,
  inferPreferredFocusHours,
  timeToOffset,
  type PlannerInputs,
} from "./plannerEngine";

function baseInputs(over: Partial<PlannerInputs> = {}): PlannerInputs {
  return {
    date: "2026-11-16",
    wakeTime: "07:00",
    sleepTargetMin: 480, // sleep 23:00 -> 07:00
    windDownMin: 45,     // wind-down 22:15 -> 23:00
    maxStudyBlockMin: 50,
    breakMin: 10,
    bufferMin: 10,
    movementGoalMin: 30,
    preferRecoverySpacing: true,
    commitments: [],
    studyGoals: [],
    ...over,
  };
}

describe("generateDayPlan", () => {
  it("handles no-history defaults, splits study with breaks, and protects sleep/wind-down", () => {
    const plan = generateDayPlan(
      baseInputs({
        studyGoals: [{ id: "g1", subject: "Neuroanatomy", minutes: 100, difficulty: 4 }],
      }),
    );

    expect(plan.usedHistoryWindows).toBe(false);
    const studyBlocks = plan.blocks.filter((b) => b.kind === "study");
    expect(studyBlocks).toHaveLength(2);
    expect(studyBlocks.every((b) => b.durationMin <= 50)).toBe(true);
    expect(plan.blocks.some((b) => b.kind === "break")).toBe(true);
    expect(plan.blocks.some((b) => b.kind === "movement")).toBe(true);
    expect(plan.blocks.find((b) => b.kind === "wind_down")).toMatchObject({
      startTime: "22:15",
      endTime: "23:00",
    });
    expect(plan.blocks.find((b) => b.kind === "sleep")).toMatchObject({
      startTime: "23:00",
      endTime: "07:00",
    });
    expect(plan.unscheduled).toEqual([]);
  });

  it("uses historical best self-rated focus windows when 5+ sessions exist", () => {
    const makeHistory = (hour: number, rating: 1 | 2 | 3 | 4 | 5): FocusSession => ({
      id: `${hour}-${rating}-${Math.random()}`,
      createdAt: "2026-11-10T08:00:00.000Z",
      updatedAt: "2026-11-10T08:00:00.000Z",
      date: "2026-11-10",
      startedAt: `2026-11-10T${String(hour).padStart(2, "0")}:00:00`,
      durationMin: 30,
      plannedMin: 30,
      subject: "Hist",
      method: "active_recall",
      focusRating: rating,
      difficulty: 3,
      distractions: 0,
    });

    const history = [
      makeHistory(15, 5),
      makeHistory(15, 5),
      makeHistory(15, 4),
      makeHistory(9, 2),
      makeHistory(9, 2),
    ];

    const inferred = inferPreferredFocusHours(history);
    expect(inferred.usedHistory).toBe(true);
    expect(inferred.hours[0]).toBe(15);

    const plan = generateDayPlan(
      baseInputs({
        studyGoals: [{ id: "g1", subject: "Recall", minutes: 45 }],
        focusHistory: history,
      }),
    );

    expect(plan.usedHistoryWindows).toBe(true);
    const study = plan.blocks.find((b) => b.kind === "study");
    expect(study?.startTime).toBe("15:00");
  });

  it("reports unscheduled items cleanly on an overpacked day without touching sleep/wind-down", () => {
    const plan = generateDayPlan(
      baseInputs({
        commitments: [
          { id: "c1", title: "Classes & lab", startTime: "08:00", endTime: "20:00" },
        ],
        studyGoals: [{ id: "g1", subject: "Biochem", minutes: 300, difficulty: 5 }],
        movementGoalMin: 30,
      }),
    );

    expect(plan.unscheduled.length).toBeGreaterThan(0);
    expect(plan.unscheduled.some((u) => u.kind === "study")).toBe(true);

    // Hard invariant: no study block ever enters wind-down or sleep (>= 22:15 from 07:00 wake).
    const wakeMin = 7 * 60;
    const windDownOffset = 1440 - 480 - 45; // 915
    for (const block of plan.blocks) {
      if (block.kind === "study") {
        const startOffset = timeToOffset(wakeMin, block.startTime);
        expect(startOffset + block.durationMin).toBeLessThanOrEqual(windDownOffset);
      }
    }
  });

  it("detects commitment overlaps and explains why in unscheduled", () => {
    const plan = generateDayPlan(
      baseInputs({
        commitments: [
          { id: "c1", title: "Morning seminar", startTime: "09:00", endTime: "11:00" },
          { id: "c2", title: "Overlapping call", startTime: "10:00", endTime: "11:30" },
        ],
      }),
    );

    expect(plan.blocks.filter((b) => b.kind === "fixed").map((b) => b.title)).toEqual([
      "Morning seminar",
    ]);
    expect(plan.unscheduled).toHaveLength(1);
    expect(plan.unscheduled[0]).toMatchObject({
      kind: "fixed",
      title: "Overlapping call",
    });
    expect(plan.unscheduled[0]?.reason).toMatch(/Overlaps/i);
  });

  it("handles midnight-crossing sleep schedules cleanly (e.g. wake 08:30, sleep 00:30–08:30)", () => {
    const plan = generateDayPlan(
      baseInputs({
        wakeTime: "08:30",
        sleepTargetMin: 480, // 8h sleep -> 00:30 to 08:30
        windDownMin: 30,     // 00:00 to 00:30
        studyGoals: [{ id: "g1", subject: "Evening review", minutes: 45 }],
      }),
    );

    const windDown = plan.blocks.find((b) => b.kind === "wind_down");
    const sleep = plan.blocks.find((b) => b.kind === "sleep");
    expect(windDown).toMatchObject({ startTime: "00:00", endTime: "00:30" });
    expect(sleep).toMatchObject({ startTime: "00:30", endTime: "08:30" });

    const balance = computePlanBalance(plan.blocks);
    expect(balance.sleepMin).toBe(480);
    expect(balance.studyMin).toBe(45);
  });
});
