import { getDb } from "@/lib/db/dexie";
import type { Task } from "@/types/domain";

import { createRepository, type CreateInput, type UpdateInput } from "./base";

const base = createRepository<Task>({
  label: "Task",
  table: () => getDb().tasks,
});

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const existing = await getDb().projects.get(projectId);
  if (!existing) {
    throw new Error(`Task: project "${projectId}" does not exist.`);
  }
}

/**
 * Task repository. Enforces valid `projectId` references, clears scheduled slots
 * on archive, and cascades deletions to all child blocks inside a transaction.
 */
export const taskRepository = {
  getById: base.getById,
  listByDateRange: base.listByDateRange,
  listAll: base.listAll,

  async create(input: CreateInput<Task>): Promise<Task> {
    const title = input.title.trim();
    if (!title) {
      throw new Error("Task: title cannot be empty.");
    }
    if (!Number.isFinite(input.estimateMin) || input.estimateMin <= 0) {
      throw new Error("Task: estimateMin must be a positive number.");
    }
    await assertProjectExists(input.projectId);
    return base.create({
      ...input,
      title,
      estimateMin: Math.round(input.estimateMin),
    });
  },

  async update(id: string, patch: UpdateInput<Task>): Promise<Task> {
    if (patch.title !== undefined && !patch.title.trim()) {
      throw new Error("Task: title cannot be empty.");
    }
    if (patch.estimateMin !== undefined && (!Number.isFinite(patch.estimateMin) || patch.estimateMin <= 0)) {
      throw new Error("Task: estimateMin must be a positive number.");
    }
    if (patch.projectId !== undefined) {
      await assertProjectExists(patch.projectId);
    }
    return base.update(id, {
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.estimateMin !== undefined ? { estimateMin: Math.round(patch.estimateMin) } : {}),
    });
  },

  async archive(id: string): Promise<Task> {
    const db = getDb();
    return db.transaction("rw", [db.tasks, db.blocks], async () => {
      const updated = await base.update(id, { status: "archived" });
      const blocks = await db.blocks.where("taskId").equals(id).toArray();
      const now = new Date().toISOString();
      await Promise.all(
        blocks
          .filter((b) => b.status === "scheduled")
          .map((b) =>
            db.blocks.put({
              ...b,
              status: "todo",
              plannedStart: undefined,
              updatedAt: now,
            }),
          ),
      );
      return updated;
    });
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", [db.tasks, db.blocks], async () => {
      await db.blocks.where("taskId").equals(id).delete();
      await db.tasks.delete(id);
    });
  },
};

export const taskRepo = taskRepository;
