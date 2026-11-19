import { getDb } from "@/lib/db/dexie";
import type { Block, ISODate, ISODateTime } from "@/types/domain";

import { createRepository, type CreateInput, type UpdateInput } from "./base";

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const base = createRepository<Block>({
  label: "Block",
  table: () => getDb().blocks,
  dateKey: "plannedDate",
});

function assertBlockInvariants(candidate: {
  taskId: string;
  plannedMin: number;
  plannedDate?: ISODate;
  plannedStart?: string;
}): void {
  if (!candidate.taskId.trim()) {
    throw new Error("Block: taskId is required.");
  }
  if (!Number.isFinite(candidate.plannedMin) || candidate.plannedMin <= 0) {
    throw new Error("Block: plannedMin must be a positive number.");
  }
  if (candidate.plannedDate !== undefined && !ISO_DATE_RE.test(candidate.plannedDate)) {
    throw new Error("Block: plannedDate must be YYYY-MM-DD.");
  }
  if (candidate.plannedStart !== undefined) {
    if (!HHMM_RE.test(candidate.plannedStart)) {
      throw new Error("Block: plannedStart must be HH:MM 24-hour time.");
    }
    if (!candidate.plannedDate) {
      throw new Error("Block: plannedStart cannot be set without plannedDate.");
    }
  }
}

async function assertTasksExist(taskIds: readonly string[]): Promise<void> {
  const db = getDb();
  const unique = [...new Set(taskIds)];
  const found = await db.tasks.bulkGet(unique);
  for (let i = 0; i < unique.length; i += 1) {
    if (!found[i]) {
      throw new Error(`Block: parent task "${unique[i]}" does not exist.`);
    }
  }
}

async function syncParentTaskCompletion(taskId: string): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);
  if (!task || task.status === "archived") return;

  const siblings = await db.blocks.where("taskId").equals(taskId).toArray();
  if (siblings.length === 0) return;

  const allDone = siblings.every((b) => b.status === "done");
  const now = new Date().toISOString();

  if (allDone && task.status !== "done") {
    await db.tasks.put({ ...task, status: "done", updatedAt: now });
  } else if (!allDone && task.status === "done") {
    await db.tasks.put({ ...task, status: "active", updatedAt: now });
  }
}

/**
 * Block repository. Enforces no-orphan `taskId`, `plannedStart` => `plannedDate`,
 * and automatic parent `Task` completion/reversion when blocks are completed or uncompleted.
 */
export const blockRepository = {
  getById: base.getById,
  listByDateRange: base.listByDateRange,
  listAll: base.listAll,

  async create(input: CreateInput<Block>): Promise<Block> {
    assertBlockInvariants(input);
    const db = getDb();
    return db.transaction("rw", [db.blocks, db.tasks], async () => {
      await assertTasksExist([input.taskId]);
      const created = await base.create({
        ...input,
        plannedMin: Math.round(input.plannedMin),
      });
      await syncParentTaskCompletion(created.taskId);
      return created;
    });
  },

  async bulkCreate(inputs: readonly CreateInput<Block>[]): Promise<Block[]> {
    if (inputs.length === 0) return [];
    for (const input of inputs) {
      assertBlockInvariants(input);
    }
    const db = getDb();
    return db.transaction("rw", [db.blocks, db.tasks], async () => {
      await assertTasksExist(inputs.map((i) => i.taskId));
      const now = new Date().toISOString();
      const records: Block[] = inputs.map((input) => ({
        ...input,
        id: input.id ?? crypto.randomUUID(),
        plannedMin: Math.round(input.plannedMin),
        createdAt: now,
        updatedAt: now,
      }));
      await db.blocks.bulkAdd(records);
      const taskIds = [...new Set(records.map((r) => r.taskId))];
      await Promise.all(taskIds.map((id) => syncParentTaskCompletion(id)));
      return records;
    });
  },

  async update(id: string, patch: UpdateInput<Block>): Promise<Block> {
    const db = getDb();
    return db.transaction("rw", [db.blocks, db.tasks], async () => {
      const existing = await db.blocks.get(id);
      if (!existing) {
        throw new Error(`Block: no record found with id "${id}".`);
      }
      const next: Block = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      assertBlockInvariants(next);
      await assertTasksExist([next.taskId]);
      await db.blocks.put(next);
      await syncParentTaskCompletion(next.taskId);
      return next;
    });
  },

  async reorder(orderedIds: readonly string[]): Promise<void> {
    if (orderedIds.length === 0) return;
    const db = getDb();
    await db.transaction("rw", db.blocks, async () => {
      const rows = await db.blocks.bulkGet([...orderedIds]);
      const now = new Date().toISOString();
      const updates: Block[] = [];
      for (let idx = 0; idx < orderedIds.length; idx += 1) {
        const row = rows[idx];
        if (!row) {
          throw new Error(`Block: cannot reorder missing block "${orderedIds[idx]}".`);
        }
        updates.push({ ...row, order: idx, updatedAt: now });
      }
      await db.blocks.bulkPut(updates);
    });
  },

  async schedule(id: string, plannedDate: ISODate, plannedStart?: string): Promise<Block> {
    if (!ISO_DATE_RE.test(plannedDate)) {
      throw new Error("Block: plannedDate must be YYYY-MM-DD.");
    }
    if (plannedStart !== undefined && !HHMM_RE.test(plannedStart)) {
      throw new Error("Block: plannedStart must be HH:MM 24-hour time.");
    }
    return this.update(id, {
      plannedDate,
      plannedStart,
      status: plannedStart ? "scheduled" : "todo",
      completedAt: undefined,
    });
  },

  async unschedule(id: string, options: { keepDate?: boolean } = {}): Promise<Block> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    return this.update(id, {
      plannedDate: options.keepDate ? existing.plannedDate : undefined,
      plannedStart: undefined,
      status: "todo",
      completedAt: undefined,
    });
  },

  async complete(
    id: string,
    opts: { actualMin?: number; focusSessionId?: string; completedAt?: ISODateTime } = {},
  ): Promise<Block> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    return this.update(id, {
      status: "done",
      actualMin:
        opts.actualMin !== undefined
          ? Math.max(0, Math.round(opts.actualMin))
          : (existing.actualMin ?? existing.plannedMin),
      focusSessionId: opts.focusSessionId ?? existing.focusSessionId,
      completedAt: opts.completedAt ?? new Date().toISOString(),
    });
  },

  async uncomplete(id: string): Promise<Block> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    const revertedStatus = existing.plannedDate && existing.plannedStart ? "scheduled" : "todo";
    return this.update(id, {
      status: revertedStatus,
      completedAt: undefined,
    });
  },

  async skip(id: string): Promise<Block> {
    return this.update(id, {
      status: "skipped",
      plannedStart: undefined,
      completedAt: undefined,
    });
  },

  async listForDate(date: ISODate): Promise<Block[]> {
    const rows = await getDb().blocks.where("plannedDate").equals(date).toArray();
    return rows.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  },

  async listUnscheduled(): Promise<Block[]> {
    const rows = await getDb().blocks.where("status").equals("todo").toArray();
    return rows
      .filter((b) => !b.plannedDate && !b.plannedStart)
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", [db.blocks, db.tasks], async () => {
      const existing = await db.blocks.get(id);
      if (!existing) return;
      await db.blocks.delete(id);
      await syncParentTaskCompletion(existing.taskId);
    });
  },
};

export const blockRepo = blockRepository;
