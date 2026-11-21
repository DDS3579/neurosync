import { validateSchedule } from "@/features/planner/blocks";
import {
  dayConstraintsFor,
  localDateAndMinute,
  shiftISODate,
} from "@/features/planner/dayContext";
import { pickNextBlock } from "@/features/planner/nextBlock";
import { timeToOffset } from "@/features/planner/plannerEngine";
import {
  blockRepository,
  dayPlanMetaRepository,
  getDayPlanByDate,
  taskRepository,
} from "@/lib/db/repositories";
import type {
  Block,
  DayPlan,
  FocusSession,
  ISODate,
  LearningMethod,
  Task,
  TaskKind,
  UserSettings,
} from "@/types/domain";

/** Heuristic starting method per kind. The user can change it before starting. */
export const KIND_METHOD: Record<TaskKind, LearningMethod> = {
  deep: "deep_reading",
  shallow: "active_recall",
  recovery: "skill_practice",
};

export type FocusSessionDraft = Omit<FocusSession, "id" | "createdAt" | "updatedAt">;

export interface CompleteBlockOptions {
  actualMin?: number;
  completedAt?: string;
  focusSessionId?: string;
  /** Present when the Focus Lab timer produced the session. */
  session?: FocusSessionDraft;
}

export interface CompleteBlockResult {
  block: Block;
  session: FocusSession | null;
  alreadyDone: boolean;
}

/**
 * THE single completion path. The board tick, the block menu and the Focus Lab
 * timer finish all call this, so linkage and task progress happen exactly once.
 */
export async function completeBlock(
  blockId: string,
  options: CompleteBlockOptions = {},
): Promise<CompleteBlockResult> {
  if (options.session) {
    const result = await blockRepository.completeWithSession({
      blockId,
      session: options.session,
      ...(options.actualMin !== undefined ? { actualMin: options.actualMin } : {}),
      ...(options.completedAt ? { completedAt: options.completedAt } : {}),
    });
    return { block: result.block, session: result.session, alreadyDone: result.alreadyDone };
  }
  const block = await blockRepository.complete(blockId, {
    ...(options.actualMin !== undefined ? { actualMin: options.actualMin } : {}),
    ...(options.focusSessionId ? { focusSessionId: options.focusSessionId } : {}),
    ...(options.completedAt ? { completedAt: options.completedAt } : {}),
  });
  return { block, session: null, alreadyDone: false };
}

export async function skipBlock(blockId: string): Promise<Block> {
  return blockRepository.skip(blockId);
}

export async function returnBlockToTray(blockId: string): Promise<Block> {
  return blockRepository.unschedule(blockId);
}

export async function addBlockToDay(blockId: string, date: ISODate): Promise<Block> {
  return blockRepository.schedule(blockId, date);
}

export async function rollBlockToDate(blockId: string, date: ISODate): Promise<Block> {
  return blockRepository.schedule(blockId, date);
}

/** Timed placement, validated against the real day before anything is written. */
export async function placeBlockAt(
  blockId: string,
  date: ISODate,
  clock: string,
  settings: UserSettings,
  plan?: DayPlan,
): Promise<Block> {
  const constraints = dayConstraintsFor(date, plan, {
    sleepTargetMin: settings.sleepTargetMin,
    deepWorkCapMin: settings.deepWorkCapMin,
    snapMin: settings.snapMin,
  });
  const target = await blockRepository.getById(blockId);
  if (!target) throw new Error("That block no longer exists.");
  const task = await taskRepository.getById(target.taskId);
  const others = (await blockRepository.listForDate(date))
    .filter((block) => block.id !== blockId)
    .map((block) => ({
      id: block.id,
      plannedDate: block.plannedDate,
      plannedStart: block.plannedStart,
      plannedMin: block.plannedMin,
      status: block.status,
    }));
  const check = validateSchedule(
    [
      ...others,
      {
        id: target.id,
        title: task?.title ?? "Block",
        plannedDate: date,
        plannedStart: clock,
        plannedMin: target.plannedMin,
        status: "scheduled" as const,
      },
    ],
    constraints,
  );
  // The engine may attach an overlap issue to either block in the pair.
  const own = check.issues.find(
    (issue) => issue.blockId === blockId || issue.otherId === blockId,
  );
  if (own) throw new Error(own.message);
  return blockRepository.schedule(blockId, date, clock);
}

export async function loadBlockWithTask(
  blockId: string,
): Promise<{ block: Block; task: Task } | null> {
  const block = await blockRepository.getById(blockId);
  if (!block) return null;
  const task = await taskRepository.getById(block.taskId);
  if (!task) return null;
  return { block, task };
}

/** Used by the command palette: no live subscription, one read on demand. */
export async function nextBlockHref(nowMs: number = Date.now()): Promise<string | null> {
  const { date, minuteOfDay } = localDateAndMinute(nowMs);
  const [plan, blocks, tasks] = await Promise.all([
    getDayPlanByDate(date),
    blockRepository.listForDate(date),
    taskRepository.listAll(),
  ]);
  const info = pickNextBlock({
    blocks,
    tasks,
    date,
    wakeTime: plan?.wakeTime ?? "07:00",
    nowMinutes: minuteOfDay,
  });
  if (!info) return null;
  const params = new URLSearchParams({
    blockId: info.blockId,
    subject: info.title,
    plannedMin: String(Math.min(240, Math.max(1, info.plannedMin))),
    method: KIND_METHOD[info.kind],
  });
  return `/focus?${params.toString()}`;
}

export function blockFocusHref(block: Block, task: Task): string {
  const params = new URLSearchParams({
    blockId: block.id,
    subject: task.title,
    plannedMin: String(Math.min(240, Math.max(1, Math.round(block.plannedMin)))),
    method: KIND_METHOD[task.kind],
  });
  return `/focus?${params.toString()}`;
}

export const SHUTDOWN_REFLECTION_MAX = 240;

export async function closeDay(
  date: ISODate,
  choices: ReadonlyArray<{ blockId: string; action: "tomorrow" | "tray" | "skip" }>,
  reflection?: string,
): Promise<{ moved: number; closed: true }> {
  const tomorrow = shiftISODate(date, 1);
  for (const choice of choices) {
    if (choice.action === "tomorrow") {
      await blockRepository.schedule(choice.blockId, tomorrow);
    } else if (choice.action === "tray") {
      await blockRepository.unschedule(choice.blockId);
    } else {
      await blockRepository.skip(choice.blockId);
    }
  }
  const trimmed = reflection?.trim().slice(0, SHUTDOWN_REFLECTION_MAX);
  await dayPlanMetaRepository.setShutdownDone(
    date,
    true,
    trimmed && trimmed.length > 0 ? trimmed : undefined,
  );
  return { moved: choices.length, closed: true };
}

/** Offsets used by the board's "now" marker without a per-minute re-render. */
export function nowOffsetFor(wakeTime: string, nowMs: number): number {
  const [h, m] = wakeTime.split(":").map(Number);
  const wakeMin = Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : 420;
  const { minuteOfDay } = localDateAndMinute(nowMs);
  return timeToOffset(wakeMin, `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`);
}
