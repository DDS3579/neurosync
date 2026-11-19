import { getDb } from "@/lib/db/dexie";
import type { Project } from "@/types/domain";

import { createRepository, type UpdateInput } from "./base";

const base = createRepository<Project>({
  label: "Project",
  table: () => getDb().projects,
});

/**
 * Project repository. Deleting a project detaches `projectId` from its tasks
 * inside a transaction so no task ever references a deleted project.
 */
export const projectRepository = {
  create: base.create,
  update: base.update,
  getById: base.getById,
  listByDateRange: base.listByDateRange,
  listAll: base.listAll,

  archive(id: string): Promise<Project> {
    return base.update(id, { archived: true });
  },

  unarchive(id: string): Promise<Project> {
    return base.update(id, { archived: false });
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", [db.projects, db.tasks], async () => {
      const linked = await db.tasks.where("projectId").equals(id).toArray();
      const now = new Date().toISOString();
      await Promise.all(
        linked.map((task) =>
          db.tasks.put({
            ...task,
            projectId: undefined,
            updatedAt: now,
          }),
        ),
      );
      await db.projects.delete(id);
    });
  },

  async patch(id: string, patch: UpdateInput<Project>): Promise<Project> {
    return base.update(id, patch);
  },
};

export const projectRepo = projectRepository;
