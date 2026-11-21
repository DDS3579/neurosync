import { describe, expect, it } from "vitest";
import type { Block, Task } from "@/types/domain";
import {
  buildPlannedActualReport,
  collectBlockSamples,
  lengthBucket,
  pickEstimationPattern,
} from "./plannedVsActual";

const DATE = "2026-11-19";
const base = { createdAt: `${DATE}T08:00:00.000Z`, updatedAt: `${DATE}T08:00:00.000Z` };

const task = (id: string, kind: Task["kind"]): Task => ({
  ...base, id, title: `Task ${id}`, kind, estimateMin: 100, status: "active",
});

const block = (id: string, over: Partial<Block> = {}): Block => ({
  ...base, id, taskId: "deep", order: 0, plannedMin: 50, status: "done", plannedDate: DATE, ...over,
});

const tasks = [task("deep", "deep"), task("shallow", "shallow"), task("recovery", "recovery")];

const blocks: Block[] = [
  block("b1", { actualMin: 62 }),
  block("b2", { actualMin: 58 }),
  block("b3", { actualMin: 66 }),
  block("b4", { taskId: "shallow", plannedMin: 25, actualMin: 20 }),
  block("b5", { taskId: "shallow", plannedMin: 30 }),
  block("b6", { taskId: "recovery", plannedMin: 20, status: "skipped" }),
  block("b7", { plannedMin: 90, status: "scheduled", plannedStart: "09:00" }),
  block("b8", { taskId: "shallow", plannedMin: 15, status: "todo" }),
];

describe("buildPlannedActualReport", () => {
  const report = buildPlannedActualReport(collectBlockSamples(blocks, tasks));

  it("counts measured, unmeasured, skipped and open blocks separately", () => {
    expect(report.totalBlocks).toBe(8);
    expect(report.doneBlocks).toBe(5);
    expect(report.measuredBlocks).toBe(4);
    expect(report.unmeasuredDoneBlocks).toBe(1);
    expect(report.skippedBlocks).toBe(1);
    expect(report.openBlocks).toBe(2);
    expect(report.plannedMin).toBe(310);
    expect(report.actualTotalMin).toBe(206);
  });

  it("averages planned and logged minutes overall with a sample size", () => {
    expect(report.overall).toMatchObject({ n: 4, avgPlannedMin: 43.8, avgActualMin: 51.5, deltaMin: 7.8 });
    expect(report.summaryLine).toBe("Planned 44m · logged 52m on average · n = 4 blocks");
  });

  it("groups by planned length rounded to 5 minutes", () => {
    expect(lengthBucket(48)).toBe(50);
    expect(lengthBucket(2)).toBe(5);
    expect(report.byLength.map((row) => row.key)).toEqual(["len:25", "len:50"]);
    expect(report.byLength[1]).toMatchObject({ n: 3, avgPlannedMin: 50, avgActualMin: 62, deltaMin: 12 });
    expect(report.byLength[0]).toMatchObject({ n: 1, avgActualMin: 20, deltaMin: -5 });
  });

  it("groups by kind and never counts skipped blocks as a kind total", () => {
    expect(report.byKind.map((row) => row.key)).toEqual(["kind:deep", "kind:shallow"]);
    expect(report.byKind[0]).toMatchObject({ n: 3, plannedTotalMin: 150, actualTotalMin: 186 });
  });

  it("always carries a self-logged caveat and explains unmeasured completions", () => {
    expect(report.caveats[0]).toMatch(/self-logged/i);
    expect(report.caveats[0]).toMatch(/self-reported/i);
    expect(report.caveats.join(" ")).toMatch(/1 completed block has no logged duration/i);
    for (const text of [report.summaryLine, ...report.caveats]) {
      expect(text).not.toMatch(/\bscore|\bproductivity|\befficiency|\bfail|\bstreak|\bshould\b/i);
    }
  });

  it("returns a calm empty report when nothing is measured", () => {
    const empty = buildPlannedActualReport([]);
    expect(empty.measuredBlocks).toBe(0);
    expect(empty.overall).toBeNull();
    expect(empty.byLength).toEqual([]);
    expect(empty.summaryLine).toBe("No completed blocks with a logged duration in this window yet.");
  });

  it("filters by an inclusive date range and drops undated blocks", () => {
    const ranged = buildPlannedActualReport(
      collectBlockSamples(
        [...blocks, block("old", { plannedDate: "2026-10-01", actualMin: 90 }), block("undated", { plannedDate: undefined, actualMin: 90 })],
        tasks,
      ),
      { range: { start: "2026-11-16", end: "2026-11-22" } },
    );
    expect(ranged.measuredBlocks).toBe(4);
  });

  it("never mutates frozen inputs", () => {
    const frozen = Object.freeze(blocks.map((b) => Object.freeze({ ...b })));
    expect(() => buildPlannedActualReport(collectBlockSamples(frozen, tasks))).not.toThrow();
  });
});

describe("pickEstimationPattern", () => {
  const report = buildPlannedActualReport(collectBlockSamples(blocks, tasks));

  it("returns the biggest gap once the minimum sample size is met", () => {
    expect(pickEstimationPattern(report, 3)?.key).toBe("len:50");
  });

  it("returns null below the minimum sample size (6 by default)", () => {
    expect(pickEstimationPattern(report)).toBeNull();
    const six = buildPlannedActualReport(
      collectBlockSamples(
        Array.from({ length: 6 }, (_, i) => block(`x${i}`, { actualMin: 62 })),
        tasks,
      ),
    );
    expect(pickEstimationPattern(six)).toMatchObject({ n: 6, deltaMin: 12 });
  });

  it("ignores gaps smaller than the threshold", () => {
    const tiny = buildPlannedActualReport(
      collectBlockSamples(Array.from({ length: 6 }, (_, i) => block(`t${i}`, { actualMin: 54 })), tasks),
    );
    expect(pickEstimationPattern(tiny)).toBeNull();
  });
});
