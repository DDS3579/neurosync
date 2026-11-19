import { describe, expect, it } from "vitest";

import {
  capacity,
  manualSplitBlock,
  mergeBlocks,
  resizeBlockPreservingTotal,
  snapTimeToGrid,
  splitIntoBlocks,
  validateSchedule,
  type BlockSplitLike,
} from "./index";

describe("splitIntoBlocks & manual split/merge/resize helpers", () => {
  it("handles exact multiples, smaller-than-block estimates, non-divisible remainders, and very large estimates", () => {
    expect(splitIntoBlocks(0, 50)).toEqual([]);
    expect(splitIntoBlocks(-20, 50)).toEqual([]);

    // Exact multiple
    expect(splitIntoBlocks(100, 50)).toEqual([50, 50]);

    // Smaller than a block -> single block rounded to nearest 5, minimum 15
    expect(splitIntoBlocks(30, 50)).toEqual([30]);
    expect(splitIntoBlocks(22, 50)).toEqual([20]);
    expect(splitIntoBlocks(10, 50)).toEqual([15]);

    // Not divisible -> ceil(estimate / blockLen) with last rounded to nearest 5 (min 15)
    expect(splitIntoBlocks(123, 50)).toEqual([50, 50, 25]);
    expect(splitIntoBlocks(102, 50)).toEqual([50, 50, 15]);

    // Very large estimate (607m / 50m = 13 blocks)
    const large = splitIntoBlocks(607, 50);
    expect(large).toHaveLength(13);
    expect(large.slice(0, 12).every((m) => m === 50)).toBe(true);
    expect(large[12]).toBe(15);
  });

  it("manually splits, merges, and resizes blocks while preserving task total", () => {
    const initial: BlockSplitLike[] = [
      {
        id: "b1",
        taskId: "t1",
        order: 0,
        plannedMin: 60,
        status: "scheduled",
        plannedDate: "2026-11-19",
        plannedStart: "09:00",
      },
      {
        id: "b2",
        taskId: "t1",
        order: 1,
        plannedMin: 40,
        status: "todo",
        plannedDate: "2026-11-19",
      },
    ];

    const splitRes = manualSplitBlock(initial, "b1", 25, { makeId: () => "b1-part2" });
    expect(splitRes.ok).toBe(true);
    if (!splitRes.ok) return;

    expect(splitRes.blocks.map((b) => b.plannedMin)).toEqual([25, 35, 40]);
    expect(splitRes.blocks.reduce((sum, b) => sum + b.plannedMin, 0)).toBe(100);
    expect(splitRes.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
    // Second split half of a scheduled block drops its plannedStart so it cannot self-overlap
    expect(splitRes.blocks[1]).toMatchObject({
      id: "b1-part2",
      status: "todo",
      plannedStart: undefined,
    });

    const resizeRes = resizeBlockPreservingTotal(splitRes.blocks, "b1", 40, {
      companionBlockId: "b1-part2",
    });
    expect(resizeRes.ok).toBe(true);
    if (!resizeRes.ok) return;
    expect(resizeRes.blocks.map((b) => b.plannedMin)).toEqual([40, 20, 40]);
    expect(resizeRes.blocks.reduce((sum, b) => sum + b.plannedMin, 0)).toBe(100);

    const mergeRes = mergeBlocks(resizeRes.blocks, "b1", "b1-part2");
    expect(mergeRes.ok).toBe(true);
    if (!mergeRes.ok) return;
    expect(mergeRes.blocks.map((b) => b.plannedMin)).toEqual([60, 40]);
    expect(mergeRes.blocks.map((b) => b.order)).toEqual([0, 1]);

    // Rejects invalid split/resize
    expect(manualSplitBlock(initial, "b1", 58).ok).toBe(false);
    expect(resizeBlockPreservingTotal(initial, "b1", 98).ok).toBe(false);
  });
});

describe("validateSchedule & snapTimeToGrid", () => {
  const baseConstraints = {
    date: "2026-11-19",
    wakeTime: "07:00",
    sleepTargetMin: 480, // sleep 23:00–07:00
    windDownMin: 45,     // wind-down 22:15–23:00
    snapMin: 15,
    commitments: [{ id: "c1", title: "Lab seminar", startTime: "10:00", endTime: "11:00" }],
  };

  it("snaps clock times cleanly and flags unaligned times or missing plannedDate", () => {
    expect(snapTimeToGrid("09:07", 15)).toBe("09:00");
    expect(snapTimeToGrid("09:08", 15)).toBe("09:15");
    expect(snapTimeToGrid("23:55", 15)).toBe("00:00");
    expect(snapTimeToGrid("bad", 15)).toBeNull();

    const missingDate = validateSchedule(
      [{ id: "b1", plannedStart: "09:00", plannedMin: 50, status: "scheduled" }],
      baseConstraints,
    );
    expect(missingDate.valid).toBe(false);
    expect(missingDate.issues[0]?.code).toBe("missing_date");

    const unaligned = validateSchedule(
      [
        {
          id: "b1",
          plannedDate: "2026-11-19",
          plannedStart: "09:10",
          plannedMin: 30,
          status: "scheduled",
        },
      ],
      baseConstraints,
    );
    expect(unaligned.valid).toBe(false);
    expect(unaligned.issues[0]?.code).toBe("unaligned_snap");
  });

  it("allows exact adjacency between blocks, commitments, and wind-down while rejecting overlaps", () => {
    const adjacent = validateSchedule(
      [
        {
          id: "b1",
          title: "Deep reading",
          plannedDate: "2026-11-19",
          plannedStart: "09:00",
          plannedMin: 60, // ends 10:00 (exact touch with Lab seminar)
          status: "scheduled",
        },
        {
          id: "b2",
          title: "Recall",
          plannedDate: "2026-11-19",
          plannedStart: "11:00", // starts 11:00 (exact touch with Lab seminar)
          plannedMin: 45,
          status: "scheduled",
        },
        {
          id: "b3",
          title: "Summary",
          plannedDate: "2026-11-19",
          plannedStart: "11:45", // exact touch with b2
          plannedMin: 30,
          status: "scheduled",
        },
        {
          id: "b4",
          title: "Evening wrap",
          plannedDate: "2026-11-19",
          plannedStart: "21:30",
          plannedMin: 45, // ends 22:15 (exact touch with wind-down)
          status: "scheduled",
        },
      ],
      baseConstraints,
    );
    expect(adjacent.valid).toBe(true);
    expect(adjacent.issues).toEqual([]);

    const overlapping = validateSchedule(
      [
        {
          id: "b1",
          title: "Block A",
          plannedDate: "2026-11-19",
          plannedStart: "09:30",
          plannedMin: 45, // overlaps 10:00 Lab seminar
          status: "scheduled",
        },
        {
          id: "b2",
          title: "Block B",
          plannedDate: "2026-11-19",
          plannedStart: "09:45",
          plannedMin: 30, // overlaps Block A
          status: "scheduled",
        },
      ],
      baseConstraints,
    );
    expect(overlapping.valid).toBe(false);
    expect(overlapping.issues.map((i) => i.code)).toContain("commitment_overlap");
    expect(overlapping.issues.map((i) => i.code)).toContain("block_overlap");
  });

  it("protects midnight-crossing sleep and wind-down windows", () => {
    const nightOwlConstraints = {
      date: "2026-11-19",
      wakeTime: "08:30",
      sleepTargetMin: 480, // sleep 00:30 -> 08:30
      windDownMin: 30,     // wind-down 00:00 -> 00:30
      snapMin: 15,
      commitments: [],
    };

    const okLate = validateSchedule(
      [
        {
          id: "b1",
          title: "Late evening block",
          plannedDate: "2026-11-19",
          plannedStart: "23:00",
          plannedMin: 60, // ends 00:00 exactly at wind-down start
          status: "scheduled",
        },
      ],
      nightOwlConstraints,
    );
    expect(okLate.valid).toBe(true);

    const hitsWindDown = validateSchedule(
      [
        {
          id: "b2",
          title: "Too late",
          plannedDate: "2026-11-19",
          plannedStart: "23:30",
          plannedMin: 45, // 23:30 -> 00:15
          status: "scheduled",
        },
      ],
      nightOwlConstraints,
    );
    expect(hitsWindDown.valid).toBe(false);
    expect(hitsWindDown.issues[0]?.code).toBe("in_wind_down");

    const hitsSleep = validateSchedule(
      [
        {
          id: "b3",
          title: "Past midnight",
          plannedDate: "2026-11-19",
          plannedStart: "01:00",
          plannedMin: 30,
          status: "scheduled",
        },
      ],
      nightOwlConstraints,
    );
    expect(hitsSleep.valid).toBe(false);
    expect(hitsSleep.issues[0]?.code).toBe("in_sleep");
  });
});

describe("capacity", () => {
  it("computes awake capacity minus merged commitments and tracks deep-work cap", () => {
    const summary = capacity({
      wakeTime: "07:00",
      sleepTargetMin: 480, // 23:00 sleep
      windDownMin: 45,     // 22:15 wind-down -> awakeWindow = 915m
      commitments: [
        { id: "c1", title: "Class A", startTime: "09:00", endTime: "11:00" }, // 120m
        { id: "c2", title: "Overlap B", startTime: "10:00", endTime: "11:30" }, // union 09:00-11:30 = 150m
      ],
      blocks: [
        { kind: "deep", plannedMin: 150, status: "scheduled" },
        { kind: "deep", plannedMin: 100, status: "todo" },
        { kind: "shallow", plannedMin: 30, status: "done" },
        { kind: "recovery", plannedMin: 20, status: "skipped" },
      ],
      deepWorkCapMin: 240,
    });

    expect(summary.awakeWindowMin).toBe(915);
    expect(summary.fixedCommitmentMin).toBe(150);
    expect(summary.availableMin).toBe(765);
    expect(summary.scheduledMin).toBe(150);
    expect(summary.todoMin).toBe(100);
    expect(summary.doneMin).toBe(30);
    expect(summary.remainingTimelineMin).toBe(765 - 150 - 30);
    expect(summary.remainingWithTodoMin).toBe(765 - 150 - 100 - 30);
    expect(summary.deepWorkPlannedMin).toBe(250);
    expect(summary.deepWorkCapMin).toBe(240);
    expect(summary.deepWorkRemainingMin).toBe(0);
    expect(summary.exceedsDeepWorkCap).toBe(true);
  });
});
