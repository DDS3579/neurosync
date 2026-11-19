import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/dexie";
import {
  blockRepository,
  dayPlanMetaRepository,
  projectRepository,
  taskRepository,
} from "@/lib/db/repositories";

const DATE = "2026-11-19";

describe("v0.4 planner repositories & invariants", () => {
  beforeEach(async () => {
    const db = getDb();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("enforces no-orphan blocks, plannedStart=>plannedDate, and task delete cascade", async () => {
    await expect(
      blockRepository.create({
        taskId: "missing-task",
        order: 0,
        plannedMin: 50,
        status: "todo",
      }),
    ).rejects.toThrow(/does not exist/i);

    const project = await projectRepository.create({ name: "Thesis", archived: false });
    const task = await taskRepository.create({
      title: "Literature synthesis",
      projectId: project.id,
      kind: "deep",
      estimateMin: 100,
      status: "active",
    });

    await expect(
      blockRepository.create({
        taskId: task.id,
        order: 0,
        plannedMin: 50,
        status: "scheduled",
        plannedStart: "09:00",
      }),
    ).rejects.toThrow(/plannedDate/i);

    const created = await blockRepository.bulkCreate([
      { taskId: task.id, order: 0, plannedMin: 50, status: "todo" },
      { taskId: task.id, order: 1, plannedMin: 50, status: "todo" },
    ]);
    expect(created).toHaveLength(2);
    expect(await blockRepository.listUnscheduled()).toHaveLength(2);

    // Deleting a project clears task.projectId without deleting the task
    await projectRepository.remove(project.id);
    const detachedTask = await taskRepository.getById(task.id);
    expect(detachedTask?.projectId).toBeUndefined();

    // Deleting the task removes all of its blocks atomically
    await taskRepository.remove(task.id);
    expect(await taskRepository.getById(task.id)).toBeUndefined();
    expect(await blockRepository.listAll()).toHaveLength(0);
  });

  it("supports schedule, unschedule, reorder, skip, and complete/uncomplete task status sync", async () => {
    const task = await taskRepository.create({
      title: "Problem set",
      kind: "deep",
      estimateMin: 100,
      status: "active",
    });
    const [b1, b2] = await blockRepository.bulkCreate([
      { taskId: task.id, order: 0, plannedMin: 50, status: "todo" },
      { taskId: task.id, order: 1, plannedMin: 50, status: "todo" },
    ]);

    const scheduled1 = await blockRepository.schedule(b1!.id, DATE, "09:00");
    expect(scheduled1).toMatchObject({
      status: "scheduled",
      plannedDate: DATE,
      plannedStart: "09:00",
    });

    const todoForDay = await blockRepository.schedule(b2!.id, DATE);
    expect(todoForDay).toMatchObject({
      status: "todo",
      plannedDate: DATE,
      plannedStart: undefined,
    });

    await blockRepository.reorder([b2!.id, b1!.id]);
    const dayBlocks = await blockRepository.listForDate(DATE);
    expect(dayBlocks.map((b) => b.id)).toEqual([b2!.id, b1!.id]);

    // Completing first block keeps task active
    await blockRepository.complete(b1!.id, { actualMin: 48, focusSessionId: "fs-1" });
    expect((await taskRepository.getById(task.id))?.status).toBe("active");

    // Completing last remaining block marks parent task done
    await blockRepository.complete(b2!.id, { actualMin: 52 });
    expect((await taskRepository.getById(task.id))?.status).toBe("done");

    // Un-completing a block reverts parent task back to active
    const reverted = await blockRepository.uncomplete(b1!.id);
    expect(reverted.status).toBe("scheduled");
    expect((await taskRepository.getById(task.id))?.status).toBe("active");

    // Skipping clears plannedStart and moving back to tray clears plannedDate
    const skipped = await blockRepository.skip(b1!.id);
    expect(skipped).toMatchObject({ status: "skipped", plannedStart: undefined });

    const backToTray = await blockRepository.unschedule(b2!.id);
    expect(backToTray).toMatchObject({
      status: "todo",
      plannedDate: undefined,
      plannedStart: undefined,
    });
    expect(await blockRepository.listUnscheduled()).toHaveLength(1);
  });

  it("archives tasks safely and keeps one DayPlanMeta row per date", async () => {
    const task = await taskRepository.create({
      title: "Inbox triage",
      kind: "shallow",
      estimateMin: 30,
      status: "active",
    });
    const [b] = await blockRepository.bulkCreate([
      {
        taskId: task.id,
        order: 0,
        plannedMin: 30,
        status: "scheduled",
        plannedDate: DATE,
        plannedStart: "16:00",
      },
    ]);

    await taskRepository.archive(task.id);
    expect((await taskRepository.getById(task.id))?.status).toBe("archived");
    expect((await blockRepository.getById(b!.id))?.status).toBe("todo");
    expect((await blockRepository.getById(b!.id))?.plannedStart).toBeUndefined();

    await dayPlanMetaRepository.setShutdownDone(DATE, false, "First pass");
    await dayPlanMetaRepository.setShutdownDone(DATE, true, "Shutdown finished");
    const metas = await dayPlanMetaRepository.listAll();
    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      date: DATE,
      shutdownDone: true,
      reflection: "Shutdown finished",
    });
  });
});
