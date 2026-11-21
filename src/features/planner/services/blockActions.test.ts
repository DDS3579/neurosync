// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/dexie";
import {
  blockRepository,
  dayPlanMetaRepository,
  focusRepository,
  settingsRepository,
  taskRepository,
} from "@/lib/db/repositories";
import type { Block, Task, UserSettings } from "@/types/domain";
import {
  closeDay,
  completeBlock,
  nextBlockHref,
  placeBlockAt,
  returnBlockToTray,
  skipBlock,
} from "./blockActions";

const DATE = "2026-11-19";

describe("block actions (real IndexedDB)", () => {
  let settings: UserSettings;
  let task: Task;
  let scheduled: Block;
  let listed: Block;

  beforeEach(async () => {
    await Promise.all(getDb().tables.map((table) => table.clear()));
    settings = await settingsRepository.ensure();
    task = await taskRepository.create({ title: "Chapter", kind: "deep", estimateMin: 100, status: "active" });
    const created = await blockRepository.bulkCreate([
      { taskId: task.id, order: 0, plannedMin: 50, status: "scheduled", plannedDate: DATE, plannedStart: "09:00" },
      { taskId: task.id, order: 1, plannedMin: 50, status: "todo", plannedDate: DATE },
    ]);
    scheduled = created[0]!;
    listed = created[1]!;
  });

  const sessionDraft = (durationMin: number) => ({
    date: DATE,
    startedAt: `${DATE}T09:00:00`,
    durationMin,
    plannedMin: 50,
    subject: "Chapter",
    method: "deep_reading" as const,
    focusRating: 4 as const,
    difficulty: 3 as const,
    distractions: 0,
  });

  it("creates exactly one linked session and completes the block atomically", async () => {
    const result = await completeBlock(scheduled.id, { session: sessionDraft(45) });
    expect(result.alreadyDone).toBe(false);
    expect(result.session?.durationMin).toBe(45);
    const stored = await blockRepository.getById(scheduled.id);
    expect(stored).toMatchObject({ status: "done", actualMin: 45, focusSessionId: result.session!.id });
    expect(stored?.completedAt).toBeTruthy();
    expect(await focusRepository.listAll()).toHaveLength(1);
    expect((await taskRepository.getById(task.id))?.status).toBe("active");
  });

  it("is idempotent: a second submit never creates a second session", async () => {
    const first = await completeBlock(scheduled.id, { session: sessionDraft(45) });
    const second = await completeBlock(scheduled.id, { session: sessionDraft(45) });
    expect(second.alreadyDone).toBe(true);
    expect(second.session?.id).toBe(first.session?.id);
    expect(await focusRepository.listAll()).toHaveLength(1);
  });

  it("marks the task done once every block is resolved, and reopens on uncomplete", async () => {
    await completeBlock(scheduled.id, { session: sessionDraft(50) });
    await skipBlock(listed.id);
    expect((await taskRepository.getById(task.id))?.status).toBe("done");
    await blockRepository.uncomplete(scheduled.id);
    expect((await taskRepository.getById(task.id))?.status).toBe("active");
  });

  it("completing without a session records planner progress only", async () => {
    const result = await completeBlock(listed.id, { actualMin: 40 });
    expect(result.session).toBeNull();
    expect(await focusRepository.listAll()).toHaveLength(0);
    expect((await blockRepository.getById(listed.id))?.actualMin).toBe(40);
  });

  it("promotes an inbox task to active when a block is placed on a date", async () => {
    const inbox = await taskRepository.create({ title: "Inbox item", kind: "shallow", estimateMin: 30, status: "inbox" });
    const [block] = await blockRepository.bulkCreate([
      { taskId: inbox.id, order: 0, plannedMin: 30, status: "todo" },
    ]);
    await placeBlockAt(block!.id, DATE, "13:00", settings);
    expect((await taskRepository.getById(inbox.id))?.status).toBe("active");
  });

  it("rejects a placement that overlaps another block, leaving it untouched", async () => {
    await expect(placeBlockAt(listed.id, DATE, "09:30", settings)).rejects.toThrow(/overlaps/i);
    expect((await blockRepository.getById(listed.id))?.plannedStart).toBeUndefined();
  });

  it("rejects a placement inside wind-down", async () => {
    await expect(placeBlockAt(listed.id, DATE, "22:00", settings)).rejects.toThrow(/wind-down/i);
  });

  it("returns a block to the tray, clearing date and time", async () => {
    await returnBlockToTray(scheduled.id);
    const stored = await blockRepository.getById(scheduled.id);
    expect(stored).toMatchObject({ status: "todo" });
    expect(stored?.plannedDate).toBeUndefined();
    expect(stored?.plannedStart).toBeUndefined();
  });

  it("closes the day: rolls, trays and skips, then persists shutdownDone and reflection", async () => {
    await closeDay(
      DATE,
      [{ blockId: scheduled.id, action: "tomorrow" }, { blockId: listed.id, action: "tray" }],
      "  Wrapped up before wind-down.  ",
    );
    expect(await blockRepository.getById(scheduled.id)).toMatchObject({ plannedDate: "2026-11-20", status: "todo" });
    expect((await blockRepository.getById(listed.id))?.plannedDate).toBeUndefined();
    const meta = await dayPlanMetaRepository.getByDate(DATE);
    expect(meta).toMatchObject({ shutdownDone: true, reflection: "Wrapped up before wind-down." });
    await closeDay(DATE, [], "");
    expect(await dayPlanMetaRepository.listAll()).toHaveLength(1);
  });

  it("builds a Focus Lab href for the next scheduled block, or null when nothing is left", async () => {
    const nowMs = new Date(`${DATE}T08:30:00`).getTime();
    const href = await nextBlockHref(nowMs);
    expect(href).toContain(`blockId=${scheduled.id}`);
    expect(href).toContain("method=deep_reading");
    await blockRepository.unschedule(scheduled.id);
    expect(await nextBlockHref(nowMs)).toBeNull();
  });

  it("survives destructured repository methods (no this-binding)", async () => {
    const { skip, schedule } = blockRepository;
    await skip(listed.id);
    expect((await blockRepository.getById(listed.id))?.status).toBe("skipped");
    await schedule(listed.id, DATE);
    expect((await blockRepository.getById(listed.id))?.status).toBe("todo");
  });
});
