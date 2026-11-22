import { timeToOffset } from "@/features/planner/plannerEngine";
import { minutesToClock } from "@/features/planner/dayContext";
import type { Block, ISODate, Project, Task, TaskKind } from "@/types/domain";

export interface NextBlockInfo {
  blockId: string;
  taskId: string;
  title: string;
  kind: TaskKind;
  plannedMin: number;
  plannedStart: string;
  endsAt: string;
  date: ISODate;
  projectName?: string;
  projectColor?: string;
  state: "in_progress" | "upcoming";
}

/**
 * The block to surface on Overview: in-progress first, otherwise the next
 * upcoming one. Returns null once nothing is left today, so the UI can offer
 * "Plan today" instead of inventing a block.
 */
export function pickNextBlock(params: {
  blocks: readonly Block[];
  tasks: readonly Task[];
  projects?: readonly Project[];
  date: ISODate;
  wakeTime: string;
  /** Minutes since local midnight. Omit/null for a day that is not today. */
  nowMinutes?: number | null;
}): NextBlockInfo | null {
  const taskById = new Map(params.tasks.map((task) => [task.id, task]));
  const projectById = new Map((params.projects ?? []).map((p) => [p.id, p]));
  const wakeMin = (() => {
    const [h, m] = params.wakeTime.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : 420;
  })();

  const placed = params.blocks
    .filter(
      (block) =>
        block.plannedDate === params.date &&
        block.status === "scheduled" &&
        Boolean(block.plannedStart),
    )
    .map((block) => {
      const start = timeToOffset(wakeMin, block.plannedStart!);
      return { block, start, end: start + Math.max(1, Math.round(block.plannedMin)) };
    })
    .sort((a, b) => a.start - b.start || a.block.id.localeCompare(b.block.id));

  if (placed.length === 0) return null;

  const now = params.nowMinutes;
  let chosen: (typeof placed)[number] | null = null;
  let state: NextBlockInfo["state"] = "upcoming";

  if (now === null || now === undefined) {
    chosen = placed[0]!;
  } else {
    const nowOffset = (((now - wakeMin) % 1440) + 1440) % 1440;
    const current = placed.find((entry) => entry.start <= nowOffset && nowOffset < entry.end);
    if (current) {
      chosen = current;
      state = "in_progress";
    } else {
      chosen = placed.find((entry) => entry.start >= nowOffset) ?? null;
    }
  }
  if (!chosen) return null;

  const task = taskById.get(chosen.block.taskId);
  const project = task?.projectId ? projectById.get(task.projectId) : undefined;
  return {
    blockId: chosen.block.id,
    taskId: chosen.block.taskId,
    title: task?.title ?? "Untitled task",
    kind: task?.kind ?? "shallow",
    plannedMin: Math.max(1, Math.round(chosen.block.plannedMin)),
    plannedStart: chosen.block.plannedStart!,
    endsAt: minutesToClock(wakeMin + chosen.end),
    date: params.date,
    ...(project?.name ? { projectName: project.name } : {}),
    ...(project?.color ? { projectColor: project.color } : {}),
    state,
  };
}
