import { describe, expect, it } from "vitest";
import type { Block, Task } from "@/types/domain";
import { pickNextBlock } from "./nextBlock";

const DATE = "2026-11-19";
const base = { createdAt: `${DATE}T08:00:00.000Z`, updatedAt: `${DATE}T08:00:00.000Z` };
const tasks: Task[] = [
  { ...base, id: "t1", title: "Chapter", kind: "deep", estimateMin: 100, status: "active", projectId: "p1" },
];
const projects = [{ ...base, id: "p1", name: "Thesis", color: "#8B5CF6", archived: false }];

const block = (id: string, over: Partial<Block> = {}): Block => ({
  ...base, id, taskId: "t1", order: 0, plannedMin: 50, status: "scheduled",
  plannedDate: DATE, plannedStart: "09:00", ...over,
});

const blocks = [
  block("a"),
  block("b", { plannedStart: "11:00", plannedMin: 30 }),
  block("done", { plannedStart: "08:00", status: "done" }),
  block("list", { plannedStart: undefined, status: "todo" }),
];

const pick = (nowMinutes: number | null) =>
  pickNextBlock({ blocks, tasks, projects, date: DATE, wakeTime: "07:00", nowMinutes });

describe("pickNextBlock", () => {
  it("prefers the in-progress block", () => {
    expect(pick(9 * 60 + 10)).toMatchObject({ blockId: "a", state: "in_progress", plannedStart: "09:00", endsAt: "09:50" });
  });

  it("falls forward to the next upcoming block", () => {
    expect(pick(10 * 60)).toMatchObject({ blockId: "b", state: "upcoming", endsAt: "11:30" });
  });

  it("returns null once nothing is left today, so the UI can offer Plan today", () => {
    expect(pick(12 * 60)).toBeNull();
  });

  it("returns the first placed block for a day that is not today", () => {
    expect(pick(null)).toMatchObject({ blockId: "a", state: "upcoming" });
  });

  it("ignores done, skipped and untimed blocks", () => {
    expect(pickNextBlock({ blocks: [blocks[2]!, blocks[3]!], tasks, date: DATE, wakeTime: "07:00", nowMinutes: null })).toBeNull();
  });

  it("carries the project name and colour for the card", () => {
    expect(pick(null)).toMatchObject({ projectName: "Thesis", projectColor: "#8B5CF6", kind: "deep" });
  });

  it("handles a midnight-crossing wake time without wrapping into yesterday", () => {
    const late = [block("late", { plannedStart: "23:30", plannedMin: 30 })];
    expect(
      pickNextBlock({ blocks: late, tasks, date: DATE, wakeTime: "08:30", nowMinutes: null }),
    ).toMatchObject({ plannedStart: "23:30", endsAt: "00:00" });
  });
});
