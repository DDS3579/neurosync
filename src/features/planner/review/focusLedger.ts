import type { ActivityKind, Block, FocusSession, LearningMethod, Task, TaskKind } from "@/types/domain";

/**
 * THE SINGLE SOURCE OF FOCUS MINUTES.
 *
 * A finished planner block and the FocusSession it created describe the SAME
 * work. Adding `Block.actualMin` on top of `FocusSession.durationMin` would count
 * every timed block twice in the brain atlas and the weekly report. This ledger
 * passes sessions through (deduplicated by id), never adds block minutes, and
 * reports how much it deliberately ignored so the exclusion is visible.
 */
export const LEDGER_NOTE =
  "Focus minutes come only from your Focus Lab sessions. A finished block points at its session instead of adding its own minutes, so nothing is counted twice.";

export const METHOD_TO_ACTIVITY: Record<LearningMethod, ActivityKind> = {
  active_recall: "active_recall",
  spaced_repetition: "spaced_repetition",
  problem_solving: "problem_solving",
  deep_reading: "reading",
  skill_practice: "skill_practice",
  teaching: "teaching",
};

/**
 * Deep blocks use the existing `deep_focus` association (prefrontal + parietal).
 * Shallow and recovery blocks keep the session's own method mapping, so no new
 * region claim is invented for them.
 */
export function activityKindForFocusSession(
  session: Pick<FocusSession, "method">,
  linkedBlockKind?: TaskKind,
): ActivityKind {
  if (linkedBlockKind === "deep") return "deep_focus";
  return METHOD_TO_ACTIVITY[session.method];
}

/** sessionId -> kind of the task owning the block that produced it. */
export function buildLinkedKindMap(
  blocks: readonly Block[],
  tasks: readonly Task[],
): Map<string, TaskKind> {
  const kindByTaskId = new Map(tasks.map((task) => [task.id, task.kind]));
  const out = new Map<string, TaskKind>();
  for (const block of blocks) {
    if (!block.focusSessionId) continue;
    out.set(block.focusSessionId, kindByTaskId.get(block.taskId) ?? "shallow");
  }
  return out;
}

export interface FocusLedger {
  sessions: FocusSession[];
  activityItems: { kind: ActivityKind; minutes: number }[];
  totalMinutes: number;
  linkedBlockIds: string[];
  /** Block minutes intentionally NOT added, because a session already covers them. */
  ignoredBlockMinutes: number;
  /** Finished blocks with no session: planner progress only, never focus minutes. */
  unlinkedDoneBlocks: number;
}

export function buildFocusLedger(
  focus: readonly FocusSession[],
  blocks: readonly Block[] = [],
  tasks: readonly Task[] = [],
): FocusLedger {
  const byId = new Map<string, FocusSession>();
  for (const session of focus) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }
  const sessions = [...byId.values()].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );

  const linkedKinds = buildLinkedKindMap(blocks, tasks);
  const activityItems: { kind: ActivityKind; minutes: number }[] = [];
  let totalMinutes = 0;
  for (const session of sessions) {
    const minutes = Math.max(0, Math.round(session.durationMin));
    if (minutes <= 0) continue;
    totalMinutes += minutes;
    activityItems.push({
      kind: activityKindForFocusSession(session, linkedKinds.get(session.id)),
      minutes,
    });
  }

  const linkedBlockIds: string[] = [];
  let ignoredBlockMinutes = 0;
  let unlinkedDoneBlocks = 0;
  for (const block of blocks) {
    if (block.status !== "done") continue;
    const minutes = Math.max(0, Math.round(block.actualMin ?? block.plannedMin));
    if (block.focusSessionId && byId.has(block.focusSessionId)) {
      linkedBlockIds.push(block.id);
      ignoredBlockMinutes += minutes;
    } else {
      unlinkedDoneBlocks += 1;
    }
  }

  return {
    sessions,
    activityItems,
    totalMinutes,
    linkedBlockIds,
    ignoredBlockMinutes,
    unlinkedDoneBlocks,
  };
}
