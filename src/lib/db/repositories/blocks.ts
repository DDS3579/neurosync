import { getDb } from "@/lib/db/dexie";
import type { Block, FocusSession, ISODate, ISODateTime } from "@/types/domain";

import { createRepository, type CreateInput, type UpdateInput } from "./base";

function newEntityId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `blk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

/**
 * Single source of truth for parent-task progress:
 *  - every block done/skipped (with at least one done) -> task done
 *  - anything still open                              -> a done task reopens
 *  - any block placed on a date                        -> an inbox task becomes active
 * Archived tasks are never touched.
 */
async function syncParentTaskCompletion(taskId: string): Promise<void> {
  const db = getDb();
  const task = await db.tasks.get(taskId);
  if (!task || task.status === "archived") return;
  const siblings = await db.blocks.where("taskId").equals(taskId).toArray();
  if (siblings.length === 0) return;
  const resolved = siblings.every((b) => b.status === "done" || b.status === "skipped");
  const anyDone = siblings.some((b) => b.status === "done");
  const anyPlaced = siblings.some((b) => Boolean(b.plannedDate));
  let next = task.status;
  if (resolved && anyDone) next = "done";
  else if (task.status === "done") next = "active";
  else if (task.status === "inbox" && anyPlaced) next = "active";
  if (next !== task.status) {
    await db.tasks.put({ ...task, status: next, updatedAt: new Date().toISOString() });
  }
}

/**
 * Standalone update so `schedule`/`complete`/`skip` never depend on `this`
 * (repositories are frequently destructured or passed as callbacks).
 */
async function updateBlock(id: string, patch: UpdateInput<Block>): Promise<Block> {
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

  update: updateBlock,

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
    return updateBlock(id, {
      plannedDate,
      plannedStart,
      status: plannedStart ? "scheduled" : "todo",
      completedAt: undefined,
    });
  },

  async unschedule(id: string, options: { keepDate?: boolean } = {}): Promise<Block> {
    const existing = await base.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    return updateBlock(id, {
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
    const existing = await base.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    return updateBlock(id, {
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
    const existing = await base.getById(id);
    if (!existing) {
      throw new Error(`Block: no record found with id "${id}".`);
    }
    const revertedStatus = existing.plannedDate && existing.plannedStart ? "scheduled" : "todo";
    return updateBlock(id, {
      status: revertedStatus,
      completedAt: undefined,
    });
  },

  async skip(id: string): Promise<Block> {
    return updateBlock(id, {
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

  /** Indexed single-task read; never scan the whole blocks table for one task. */
  async listForTask(taskId: string): Promise<Block[]> {
    const rows = await getDb().blocks.where("taskId").equals(taskId).toArray();
    return rows.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  },

  /**
   * THE completion write for a timed block: creates the FocusSession, links it,
   * sets actualMin/completedAt/status and re-syncs the parent task in ONE
   * transaction. Idempotent — a block already linked to a session is returned
   * as-is, so a double submit can never create a second session (no double count).
   */
  async completeWithSession(input: {
    blockId: string;
    session: Omit<FocusSession, "id" | "createdAt" | "updatedAt"> & { id?: string };
    actualMin?: number;
    completedAt?: ISODateTime;
  }): Promise<{ block: Block; session: FocusSession; alreadyDone: boolean }> {
    if (!Number.isFinite(input.session.durationMin) || input.session.durationMin <= 0) {
      throw new Error("FocusSession: durationMin must be a positive number of minutes.");
    }
    const db = getDb();
    return db.transaction("rw", [db.blocks, db.tasks, db.focusSessions], async () => {
      const existing = await db.blocks.get(input.blockId);
      if (!existing) {
        throw new Error(`Block: no record found with id "${input.blockId}".`);
      }
      if (existing.status === "done" && existing.focusSessionId) {
        const linked = await db.focusSessions.get(existing.focusSessionId);
        if (linked) return { block: existing, session: linked, alreadyDone: true };
      }
      const now = new Date().toISOString();
      const session: FocusSession = {
        ...input.session,
        id: input.session.id ?? newEntityId(),
        createdAt: now,
        updatedAt: now,
      };
      await db.focusSessions.add(session);
      const block: Block = {
        ...existing,
        status: "done",
        actualMin: Math.max(0, Math.round(input.actualMin ?? session.durationMin)),
        focusSessionId: session.id,
        completedAt: input.completedAt ?? now,
        updatedAt: now,
      };
      assertBlockInvariants(block);
      await db.blocks.put(block);
      await syncParentTaskCompletion(block.taskId);
      return { block, session, alreadyDone: false };
    });
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
