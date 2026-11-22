import { describe, expect, it } from "vitest";
import { format, parseISO, subDays } from "date-fns";
import type { Block, DayPlan, DayPlanMeta, Insight, InsightInput, ISODate, Task, UserSettings } from "@/types/domain";
import { computeInsights } from "./index";
import { PLANNER_RULES } from "./plannerRules";

const TODAY: ISODate = "2026-11-16";
const d = (offset: number): ISODate => format(subDays(parseISO(TODAY), offset), "yyyy-MM-dd");
const base = { createdAt: `${TODAY}T08:00:00`, updatedAt: `${TODAY}T08:00:00` };

const settings: UserSettings = {
  ...base, id: "me", sleepTargetMin: 480, focusDefaultMin: 25, breakDefaultMin: 5,
  onboarded: true, schemaVersion: 10,
};

const tasks: Task[] = [
  { ...base, id: "deep", title: "Deep work", kind: "deep", estimateMin: 300, status: "active" },
  { ...base, id: "shallow", title: "Admin", kind: "shallow", estimateMin: 300, status: "active" },
];

const block = (id: string, over: Partial<Block> = {}): Block => ({
  ...base, id, taskId: "deep", order: 0, plannedMin: 50, status: "done", plannedDate: d(1), ...over,
});

/** available = 915 − 780 = 135m; planned = 90 scheduled + 120 listed = 210m. */
function overpackedDay(offset: number): { plan: DayPlan; blocks: Block[] } {
  const date = d(offset);
  return {
    plan: {
      ...base, id: `plan-${offset}`, date, wakeTime: "07:00", sleepTargetMin: 480, windDownMin: 45,
      maxStudyBlockMin: 50, breakMin: 10, bufferMin: 10, movementGoalMin: 30, preferRecoverySpacing: true,
      commitments: [{ id: `c-${offset}`, title: "Classes", startTime: "07:00", endTime: "20:00" }],
      studyGoals: [], blocks: [], unscheduled: [],
    },
    blocks: [
      block(`s${offset}-1`, { taskId: "shallow", plannedMin: 30, status: "scheduled", plannedDate: date, plannedStart: "20:00" }),
      block(`s${offset}-2`, { taskId: "shallow", plannedMin: 30, status: "scheduled", plannedDate: date, plannedStart: "20:45" }),
      block(`s${offset}-3`, { taskId: "shallow", plannedMin: 30, status: "scheduled", plannedDate: date, plannedStart: "21:30" }),
      block(`l${offset}-1`, { taskId: "shallow", plannedMin: 60, status: "todo", plannedDate: date }),
      block(`l${offset}-2`, { taskId: "shallow", plannedMin: 60, status: "todo", plannedDate: date }),
    ],
  };
}

const estimationBlocks = (count: number, actualMin: number): Block[] =>
  Array.from({ length: count }, (_, i) =>
    block(`e${i}`, { plannedMin: 50, actualMin, plannedDate: d(4 + i) }),
  );

function makeInput(over: Partial<InsightInput> = {}): InsightInput {
  const days = [1, 2, 3].map(overpackedDay);
  return {
    settings, sleep: [], checkins: [], focus: [], movement: [], nutrition: [], habits: [], habitLogs: [],
    tasks,
    blocks: [...days.flatMap((day) => day.blocks), ...estimationBlocks(6, 62)],
    dayPlans: days.map((day) => day.plan),
    dayPlanMeta: [0, 1, 2].map((offset) => ({
      ...base, id: `meta-${offset}`, date: d(offset), shutdownDone: true,
    })),
    ...over,
  };
}

const run = (id: string, input: InsightInput): Insight | null =>
  PLANNER_RULES.find((rule) => rule.id === id)!.run(input, TODAY);

describe("block_estimation_pattern", () => {
  it("fires at exactly 6 completed blocks with a 12 minute average gap", () => {
    const insight = run("block_estimation_pattern", makeInput());
    expect(insight?.kind).toBe("observation");
    expect(insight?.title).toBe("50m blocks have been running longer than planned");
    expect(insight?.evidence.join(" ")).toMatch(/6 completed 50m blocks/);
    expect(insight?.confidence?.sampleSize).toBe(6);
  });

  it("returns null with 5 blocks and with a gap under 5 minutes", () => {
    expect(run("block_estimation_pattern", makeInput({ blocks: estimationBlocks(5, 62) }))).toBeNull();
    expect(run("block_estimation_pattern", makeInput({ blocks: estimationBlocks(6, 54) }))).toBeNull();
  });

  it("describes shorter blocks neutrally too", () => {
    const insight = run("block_estimation_pattern", makeInput({ blocks: estimationBlocks(6, 38) }));
    expect(insight?.title).toMatch(/shorter than planned/);
  });
});

describe("day_overpacking_pattern", () => {
  it("fires when 3 of the last planned days exceed available time", () => {
    const insight = run("day_overpacking_pattern", makeInput());
    expect(insight?.pillar).toBe("wellbeing");
    expect(insight?.kind).toBe("reflection");
    expect(insight?.evidence[0]).toMatch(/3 of \d+ planned days over available time/);
  });

  it("returns null with only 2 overpacked days", () => {
    const days = [1, 2].map(overpackedDay);
    expect(
      run("day_overpacking_pattern", makeInput({
        blocks: [...days.flatMap((x) => x.blocks), ...estimationBlocks(6, 62)],
        dayPlans: days.map((x) => x.plan),
      })),
    ).toBeNull();
  });
});

describe("shallow_blocks_scattered", () => {
  it("fires when at least 2 days hold 3+ shallow blocks in separate runs", () => {
    const insight = run("shallow_blocks_scattered", makeInput());
    expect(insight?.kind).toBe("reflection");
    expect(insight?.body).toMatch(/Grouping them into one stretch/);
  });

  it("returns null when the shallow blocks are batched back to back", () => {
    const days = [1, 2, 3].map(overpackedDay);
    const batched = days.flatMap((day) =>
      day.blocks.map((b) =>
        b.id.endsWith("-2") ? { ...b, plannedStart: "20:30" } : b.id.endsWith("-3") ? { ...b, plannedStart: "21:00" } : b,
      ),
    );
    expect(
      run("shallow_blocks_scattered", makeInput({ blocks: [...batched, ...estimationBlocks(6, 62)] })),
    ).toBeNull();
  });
});

describe("shutdown_ritual_days", () => {
  const meta = (count: number): DayPlanMeta[] =>
    Array.from({ length: count }, (_, i) => ({ ...base, id: `m${i}`, date: d(i), shutdownDone: true }));

  it("fires at exactly 3 closed days in the last 7", () => {
    const insight = run("shutdown_ritual_days", makeInput({ dayPlanMeta: meta(3) }));
    expect(insight?.kind).toBe("milestone");
    expect(insight?.evidence[0]).toBe("Days closed: 3 of the last 7");
  });

  it("returns null with 2 closed days or with days outside the window", () => {
    expect(run("shutdown_ritual_days", makeInput({ dayPlanMeta: meta(2) }))).toBeNull();
    expect(
      run("shutdown_ritual_days", makeInput({
        dayPlanMeta: [{ ...base, id: "old", date: d(9), shutdownDone: true }],
      })),
    ).toBeNull();
  });

  it("counts distinct dates, not duplicate rows", () => {
    const duplicated = [meta(3)[0]!, { ...meta(3)[0]!, id: "dup" }, meta(3)[1]!];
    expect(run("shutdown_ritual_days", makeInput({ dayPlanMeta: duplicated }))).toBeNull();
  });
});

describe("planner rules — safety, confidence and feedback", () => {
  const BANNED = [
    /\bscore/i, /\bproductivity\b/i, /\befficiency\b/i, /\bbrain health\b/i, /\bgrew\b/i,
    /\bgrow/i, /\bstrengthen/i, /\bstreak/i, /\bfail/i, /\bsham(e|ing)\b/i, /\bguilt/i,
    /\blazy\b/i, /\bbad\b/i, /\bgood\b/i, /\bshould\b/i, /\boverdue\b/i, /\bdiagnos/i, /\boptimiz/i,
  ];

  const all = PLANNER_RULES.map((rule) => rule.run(makeInput(), TODAY)).filter(
    (insight): insight is Insight => insight !== null,
  );

  it("fires every planner rule on the shared fixture", () => {
    expect(new Set(all.map((i) => i.id)).size).toBe(PLANNER_RULES.length);
  });

  it("contains no banned phrase and always carries evidence plus a self-reported caveat", () => {
    for (const insight of all) {
      const text = [insight.title, insight.body, insight.caveat, ...insight.evidence].join("\n");
      for (const pattern of BANNED) expect(text).not.toMatch(pattern);
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.caveat).toMatch(/self-reported/i);
      expect(insight.confidence).toBeDefined();
      expect(insight.confidence!.summary).toMatch(/Based on \d+/);
    }
  });

  it("returns null for every rule when no planner data exists", () => {
    const empty = makeInput({ blocks: [], tasks: [], dayPlans: [], dayPlanMeta: [] });
    for (const rule of PLANNER_RULES) expect(rule.run(empty, TODAY)).toBeNull();
    expect(computeInsights(empty, TODAY)).toEqual([]);
  });

  it("feeds the existing dismiss and snooze systems", () => {
    const input = makeInput();
    const before = computeInsights(input, TODAY);
    expect(before.some((i) => i.id === "block_estimation_pattern")).toBe(true);
    const dismissed = computeInsights(input, TODAY, {
      feedback: [{
        ...base, id: "block_estimation_pattern", insightId: "block_estimation_pattern", status: "dismissed",
      }],
    });
    expect(dismissed.some((i) => i.id === "block_estimation_pattern")).toBe(false);
    const snoozed = computeInsights(input, TODAY, {
      feedback: [{
        ...base, id: "shutdown_ritual_days", insightId: "shutdown_ritual_days",
        status: "snoozed", snoozeUntil: "2026-11-30",
      }],
    });
    expect(snoozed.some((i) => i.id === "shutdown_ritual_days")).toBe(false);
  });

  it("is deterministic and never mutates frozen input", () => {
    const input = makeInput();
    const a = computeInsights(input, TODAY);
    expect(computeInsights(input, TODAY)).toEqual(a);
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === "object") {
        Object.freeze(value);
        for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
      }
    };
    freeze(input);
    expect(computeInsights(input, TODAY)).toEqual(a);
  });
});
