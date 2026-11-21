import { describe, expect, it } from "vitest";
import { generateDayPlan, type PlannerInputs } from "@/features/planner/plannerEngine";
import { buildBlocksIcs } from "./ics";
import { parseIcsBusyIntervals } from "./parseIcs";
import { busyDurationMin, toFixedCommitments } from "./busy";
import { createCompositeCalendarProvider, createStaticCalendarProvider } from "./memoryProvider";
import type { BusyInterval } from "./types";

const DATE = "2026-11-19";

const inputs = (over: Partial<PlannerInputs> = {}): PlannerInputs => ({
  date: DATE, wakeTime: "07:00", sleepTargetMin: 480, windDownMin: 45,
  maxStudyBlockMin: 50, breakMin: 10, bufferMin: 0, movementGoalMin: 0,
  preferRecoverySpacing: false, commitments: [], studyGoals: [], ...over,
});

const interval = (over: Partial<BusyInterval> & { id: string }): BusyInterval => ({
  title: "Imported class", date: DATE, startTime: "09:00", endTime: "11:00",
  readOnly: true, source: "imported-ics", ...over,
});

describe("CalendarProvider interface", () => {
  it("returns only intervals inside the requested range, marked read-only", async () => {
    const provider = createStaticCalendarProvider({
      id: "imported-ics",
      name: "Imported .ics (read-only)",
      intervals: [interval({ id: "a" }), interval({ id: "b", date: "2026-12-01" })],
    });
    const busy = await provider.getBusyIntervals({ start: DATE, end: DATE });
    expect(busy).toHaveLength(1);
    expect(busy[0]).toMatchObject({ id: "a", readOnly: true });
  });

  it("exports blocks through the same interface as the local provider", async () => {
    const provider = createStaticCalendarProvider({ id: "p", name: "P", intervals: [] });
    const result = await provider.exportBlocks([
      { id: "b1", title: "Chapter", date: DATE, startTime: "09:00", plannedMin: 50, kind: "deep" },
    ]);
    expect(result.mimeType).toBe("text/calendar;charset=utf-8");
    expect(result.content).toContain("DTSTART:20261119T090000\r\n");
    expect(result.filename).toBe("neurosync-plan-2026-11-19.ics");
  });

  it("merges providers without duplicating the same window", async () => {
    const a = createStaticCalendarProvider({ id: "a", name: "A", intervals: [interval({ id: "x" })] });
    const b = createStaticCalendarProvider({ id: "b", name: "B", intervals: [interval({ id: "y" })] });
    const composite = createCompositeCalendarProvider([a, b]);
    expect(await composite.getBusyIntervals({ start: DATE, end: DATE })).toHaveLength(1);
  });

  it("computes wrapped durations correctly", () => {
    expect(busyDurationMin({ startTime: "09:00", endTime: "11:00" })).toBe(120);
    expect(busyDurationMin({ startTime: "23:30", endTime: "00:15" })).toBe(45);
    expect(busyDurationMin({ startTime: "09:00", endTime: "09:00" })).toBe(0);
  });
});

describe("planner engine consumes provider commitments", () => {
  it("places study around an imported busy window", async () => {
    const provider = createStaticCalendarProvider({
      id: "imported-ics", name: "Imported", intervals: [interval({ id: "class" })],
    });
    const commitments = toFixedCommitments(await provider.getBusyIntervals({ start: DATE, end: DATE }));
    const plan = generateDayPlan(
      inputs({ commitments, studyGoals: [{ id: "g1", subject: "Reading", minutes: 60 }] }),
    );
    const fixed = plan.blocks.filter((b) => b.kind === "fixed");
    expect(fixed.map((b) => b.title)).toEqual(["Imported class"]);
    const study = plan.blocks.filter((b) => b.kind === "study");
    expect(study.length).toBeGreaterThan(0);
    for (const block of study) {
      const overlapsClass =
        block.startTime < "11:00" && "09:00" < block.endTime;
      expect(overlapsClass).toBe(false);
    }
  });

  it("reports an overlapping imported commitment as unscheduled instead of overwriting it", async () => {
    const provider = createStaticCalendarProvider({
      id: "imported-ics", name: "Imported",
      intervals: [interval({ id: "a" }), interval({ id: "b", title: "Overlapping lab", startTime: "10:00", endTime: "11:30" })],
    });
    const commitments = toFixedCommitments(await provider.getBusyIntervals({ start: DATE, end: DATE }));
    const plan = generateDayPlan(inputs({ commitments }));
    expect(plan.blocks.filter((b) => b.kind === "fixed")).toHaveLength(1);
    expect(plan.unscheduled).toHaveLength(1);
    expect(plan.unscheduled[0]?.reason).toMatch(/Overlaps/i);
  });

  it("round-trips: export a plan, re-import it, and feed it back as commitments", async () => {
    const first = generateDayPlan(inputs({ studyGoals: [{ id: "g1", subject: "Reading", minutes: 50 }] }));
    const study = first.blocks.find((b) => b.kind === "study")!;
    const exported = buildBlocksIcs([
      { id: "b1", title: study.title, date: DATE, startTime: study.startTime, plannedMin: study.durationMin, kind: "deep" },
    ]);
    const parsed = parseIcsBusyIntervals(exported.content, { start: DATE, end: DATE });
    const commitments = toFixedCommitments(parsed.intervals);
    const second = generateDayPlan(
      inputs({ commitments, studyGoals: [{ id: "g2", subject: "Recall", minutes: 50 }] }),
    );
    const moved = second.blocks.filter((b) => b.kind === "study");
    expect(moved.length).toBeGreaterThan(0);
    for (const block of moved) {
      expect(block.startTime < study.endTime && study.startTime < block.endTime).toBe(false);
    }
  });
});
