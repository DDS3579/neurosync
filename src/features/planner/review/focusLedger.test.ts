import { describe, expect, it } from "vitest";
import { activityToRegionIntensity } from "@/data/brainRegions";
import { buildWeeklyReport } from "@/lib/insights";
import type { Block, FocusSession, InsightInput, Task, UserSettings } from "@/types/domain";
import { activityKindForFocusSession, buildFocusLedger } from "./focusLedger";

const DATE = "2026-11-19";
const WEEK_START = "2026-11-16";
const base = { createdAt: `${DATE}T08:00:00.000Z`, updatedAt: `${DATE}T08:00:00.000Z` };

const settings: UserSettings = {
  ...base, id: "me", sleepTargetMin: 480, focusDefaultMin: 25, breakDefaultMin: 5,
  onboarded: true, schemaVersion: 10,
};

const session: FocusSession = {
  ...base, id: "fs-1", date: DATE, startedAt: `${DATE}T09:00:00`, durationMin: 50,
  plannedMin: 50, subject: "Synaptic plasticity", method: "deep_reading",
  focusRating: 4, difficulty: 3, distractions: 0,
};

const deepTask: Task = { ...base, id: "t1", title: "Chapter", kind: "deep", estimateMin: 100, status: "active" };

const linkedBlock: Block = {
  ...base, id: "b1", taskId: "t1", order: 0, plannedMin: 50, status: "done",
  actualMin: 50, focusSessionId: "fs-1", completedAt: `${DATE}T09:50:00.000Z`,
  plannedDate: DATE, plannedStart: "09:00",
};

const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  settings, sleep: [], checkins: [], focus: [], movement: [], nutrition: [], habits: [], habitLogs: [], ...over,
});

const SOFT_K = 40;

describe("focus ledger — a completed block never double counts", () => {
  it("counts the linked session once and reports the block minutes it ignored", () => {
    const ledger = buildFocusLedger([session], [linkedBlock], [deepTask]);
    expect(ledger.sessions).toHaveLength(1);
    expect(ledger.totalMinutes).toBe(50);
    expect(ledger.linkedBlockIds).toEqual(["b1"]);
    expect(ledger.ignoredBlockMinutes).toBe(50);
    expect(ledger.unlinkedDoneBlocks).toBe(0);
  });

  it("maps a deep block's session to the existing deep_focus association", () => {
    expect(activityKindForFocusSession(session, "deep")).toBe("deep_focus");
    expect(activityKindForFocusSession(session, "shallow")).toBe("reading");
    expect(activityKindForFocusSession(session, "recovery")).toBe("reading");
    expect(activityKindForFocusSession(session, undefined)).toBe("reading");
    const ledger = buildFocusLedger([session], [linkedBlock], [deepTask]);
    expect(ledger.activityItems).toEqual([{ kind: "deep_focus", minutes: 50 }]);
  });

  it("produces exactly single-session region intensity, never the doubled value", () => {
    const ledger = buildFocusLedger([session], [linkedBlock], [deepTask]);
    const viaLedger = activityToRegionIntensity(ledger.activityItems);
    const single = activityToRegionIntensity([{ kind: "deep_focus", minutes: 50 }]);
    const doubled = activityToRegionIntensity([{ kind: "deep_focus", minutes: 100 }]);
    expect(viaLedger).toEqual(single);
    expect(viaLedger.prefrontal).toBeCloseTo(1 - Math.exp(-50 / SOFT_K), 6);
    expect(viaLedger.parietal).toBeCloseTo(1 - Math.exp(-35 / SOFT_K), 6);
    expect(viaLedger.prefrontal!).toBeLessThan(doubled.prefrontal!);
  });

  it("keeps the weekly report at 50 minutes, not 100", () => {
    const report = buildWeeklyReport(
      input({ focus: [session], blocks: [linkedBlock], tasks: [deepTask] }),
      WEEK_START,
    );
    expect(report.focus.totalMin).toBe(50);
    expect(report.focus.sessions).toBe(1);
    expect(report.daily.find((d) => d.date === DATE)?.focusMin).toBe(50);
    expect(report.brainActivity.regions.prefrontal).toBeCloseTo(1 - Math.exp(-50 / SOFT_K), 6);
    expect(report.planner.measuredBlocks).toBe(1);
    expect(report.planner.overall).toMatchObject({ avgPlannedMin: 50, avgActualMin: 50, deltaMin: 0 });
  });

  it("naively adding block minutes WOULD double the report — proving the guard matters", () => {
    const naive = buildWeeklyReport(
      input({ focus: [session, { ...session, id: "shadow", durationMin: linkedBlock.actualMin! }] }),
      WEEK_START,
    );
    expect(naive.focus.totalMin).toBe(100);
    const guarded = buildWeeklyReport(
      input({ focus: [session], blocks: [linkedBlock], tasks: [deepTask] }),
      WEEK_START,
    );
    expect(guarded.focus.totalMin).toBe(50);
  });

  it("deduplicates a session passed twice", () => {
    const ledger = buildFocusLedger([session, session], [linkedBlock], [deepTask]);
    expect(ledger.sessions).toHaveLength(1);
    expect(ledger.totalMinutes).toBe(50);
  });

  it("treats an unlinked done block as planner progress only, never focus minutes", () => {
    const unlinked: Block = { ...linkedBlock, id: "b2", focusSessionId: undefined };
    const ledger = buildFocusLedger([session], [linkedBlock, unlinked], [deepTask]);
    expect(ledger.totalMinutes).toBe(50);
    expect(ledger.unlinkedDoneBlocks).toBe(1);
    const report = buildWeeklyReport(
      input({ focus: [session], blocks: [linkedBlock, unlinked], tasks: [deepTask] }),
      WEEK_START,
    );
    expect(report.focus.totalMin).toBe(50);
    expect(report.planner.measuredBlocks).toBe(2);
  });

  it("handles blocks with no sessions at all", () => {
    const ledger = buildFocusLedger([], [linkedBlock], [deepTask]);
    expect(ledger.totalMinutes).toBe(0);
    expect(ledger.activityItems).toEqual([]);
    expect(activityToRegionIntensity(ledger.activityItems)).toEqual({});
    expect(buildWeeklyReport(input({ blocks: [linkedBlock], tasks: [deepTask] }), WEEK_START).focus.totalMin).toBe(0);
  });
});
