import { formatOffsetTime, timeToOffset } from "@/features/planner/plannerEngine";
import { parseHHMM } from "@/features/reminders/reminderUtils";
import type {
  BlockStatus,
  ISODate,
  PlannerFixedCommitment,
  TaskKind,
} from "@/types/domain";

export type ScheduleIssueCode =
  | "missing_date"
  | "missing_start"
  | "invalid_time"
  | "out_of_range"
  | "unaligned_snap"
  | "in_wind_down"
  | "in_sleep"
  | "commitment_overlap"
  | "block_overlap";

export interface ScheduleIssue {
  code: ScheduleIssueCode;
  blockId: string;
  otherId?: string;
  message: string;
}

export interface ScheduleValidationResult {
  valid: boolean;
  issues: ScheduleIssue[];
}

export interface DayScheduleConstraints {
  date: ISODate;
  wakeTime: string;
  sleepTargetMin: number;
  windDownMin: number;
  snapMin?: number;
  commitments?: readonly PlannerFixedCommitment[];
}

export interface SchedulableBlockLike {
  id: string;
  title?: string;
  plannedDate?: ISODate;
  plannedStart?: string;
  plannedMin: number;
  status: BlockStatus;
}

function durationBetweenHHMM(startHHMM: string, endHHMM: string): number {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (s === null || e === null) return 0;
  if (e > s) return e - s;
  if (e < s) return 1440 - s + e;
  return 0;
}

/** Snaps a 24-hour `HH:MM` clock string to the nearest `snapMin` step. */
export function snapTimeToGrid(hhmm: string, snapMin: number = 15): string | null {
  const mins = parseHHMM(hhmm);
  if (mins === null) return null;
  const safeSnap = Math.max(1, Math.round(snapMin));
  const snapped = (Math.round(mins / safeSnap) * safeSnap) % 1440;
  const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
  const mm = String(snapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Validates scheduled blocks against date/time pairing, snap alignment,
 * wake-to-wind-down bounds (supporting midnight-crossing sleep), fixed
 * commitments, and block-to-block overlaps (exact adjacency allowed).
 */
export function validateSchedule(
  blocks: readonly SchedulableBlockLike[],
  constraints: DayScheduleConstraints,
): ScheduleValidationResult {
  const issues: ScheduleIssue[] = [];
  const wakeMin = parseHHMM(constraints.wakeTime) ?? 420;
  const sleepMin = Math.max(60, Math.min(960, Math.round(constraints.sleepTargetMin)));
  const windDownMin = Math.max(0, Math.min(360, Math.round(constraints.windDownMin)));
  const snapMin = Math.max(1, Math.round(constraints.snapMin ?? 15));

  const sleepStart = 1440 - sleepMin;
  const windDownStart = Math.max(0, sleepStart - windDownMin);

  interface PlacedInterval {
    id: string;
    label: string;
    start: number;
    end: number;
    startTime: string;
    endTime: string;
  }

  const commitmentIntervals: PlacedInterval[] = (constraints.commitments ?? [])
    .map((c) => {
      const start = timeToOffset(wakeMin, c.startTime);
      const dur = durationBetweenHHMM(c.startTime, c.endTime);
      return {
        id: c.id,
        label: c.title,
        start,
        end: start + dur,
        startTime: c.startTime,
        endTime: c.endTime,
      };
    })
    .filter((iv) => iv.end > iv.start);

  const placedBlocks: PlacedInterval[] = [];

  for (const block of blocks) {
    if (block.plannedStart && !block.plannedDate) {
      issues.push({
        code: "missing_date",
        blockId: block.id,
        message: "A block with a start time must also have a planned date.",
      });
      continue;
    }

    if (block.plannedDate !== constraints.date || block.status !== "scheduled") {
      continue;
    }

    if (!block.plannedStart) {
      issues.push({
        code: "missing_start",
        blockId: block.id,
        message: "Scheduled block is missing a start time.",
      });
      continue;
    }

    const clockMin = parseHHMM(block.plannedStart);
    if (clockMin === null) {
      issues.push({
        code: "invalid_time",
        blockId: block.id,
        message: `Invalid start time "${block.plannedStart}".`,
      });
      continue;
    }

    if (!Number.isFinite(block.plannedMin) || block.plannedMin <= 0 || block.plannedMin > 1440) {
      issues.push({
        code: "out_of_range",
        blockId: block.id,
        message: "Block duration must be between 1 and 1440 minutes.",
      });
      continue;
    }

    if (clockMin % snapMin !== 0) {
      issues.push({
        code: "unaligned_snap",
        blockId: block.id,
        message: `Start time ${block.plannedStart} is not aligned to ${snapMin}-minute steps.`,
      });
    }

    const start = timeToOffset(wakeMin, block.plannedStart);
    const end = start + Math.round(block.plannedMin);
    const blockEndTime = formatOffsetTime(wakeMin, end);
    const label = block.title ?? `Block ${block.id}`;

    if (start >= sleepStart || end > sleepStart) {
      issues.push({
        code: "in_sleep",
        blockId: block.id,
        message: `${label} (${block.plannedStart}–${blockEndTime}) enters the protected sleep window (${formatOffsetTime(wakeMin, sleepStart)}–${formatOffsetTime(wakeMin, 1440)}).`,
      });
    } else if (start >= windDownStart || end > windDownStart) {
      issues.push({
        code: "in_wind_down",
        blockId: block.id,
        message: `${label} (${block.plannedStart}–${blockEndTime}) enters the protected wind-down window (${formatOffsetTime(wakeMin, windDownStart)}–${formatOffsetTime(wakeMin, sleepStart)}).`,
      });
    }

    for (const c of commitmentIntervals) {
      if (start < c.end && c.start < end) {
        issues.push({
          code: "commitment_overlap",
          blockId: block.id,
          otherId: c.id,
          message: `${label} (${block.plannedStart}–${blockEndTime}) overlaps fixed commitment "${c.label}" (${c.startTime}–${c.endTime}).`,
        });
      }
    }

    placedBlocks.push({
      id: block.id,
      label,
      start,
      end,
      startTime: block.plannedStart,
      endTime: blockEndTime,
    });
  }

  placedBlocks.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < placedBlocks.length; i += 1) {
    const a = placedBlocks[i]!;
    for (let j = i + 1; j < placedBlocks.length; j += 1) {
      const b = placedBlocks[j]!;
      if (b.start >= a.end) break;
      if (a.start < b.end && b.start < a.end) {
        issues.push({
          code: "block_overlap",
          blockId: a.id,
          otherId: b.id,
          message: `${a.label} (${a.startTime}–${a.endTime}) overlaps ${b.label} (${b.startTime}–${b.endTime}).`,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export interface DayCapacityBlockInput {
  kind: TaskKind;
  plannedMin: number;
  status: BlockStatus;
}

export interface DayCapacityInput {
  wakeTime: string;
  sleepTargetMin: number;
  windDownMin: number;
  commitments: readonly PlannerFixedCommitment[];
  blocks?: readonly DayCapacityBlockInput[];
  deepWorkCapMin?: number;
}

export interface DayCapacitySummary {
  awakeWindowMin: number;
  fixedCommitmentMin: number;
  availableMin: number;
  scheduledMin: number;
  todoMin: number;
  doneMin: number;
  remainingTimelineMin: number;
  remainingWithTodoMin: number;
  deepWorkPlannedMin: number;
  deepWorkCapMin: number;
  deepWorkRemainingMin: number;
  exceedsDeepWorkCap: boolean;
}

/**
 * Computes daytime capacity from `wakeTime` to `wind_down`, subtracting merged
 * fixed commitments, and compares planned deep-work minutes to `deepWorkCapMin`.
 */
export function capacity(day: DayCapacityInput): DayCapacitySummary {
  const wakeMin = parseHHMM(day.wakeTime) ?? 420;
  const sleepMin = Math.max(60, Math.min(960, Math.round(day.sleepTargetMin)));
  const windDownMin = Math.max(0, Math.min(360, Math.round(day.windDownMin)));
  const deepWorkCapMin = Math.max(15, Math.round(day.deepWorkCapMin ?? 240));

  const sleepStart = 1440 - sleepMin;
  const windDownStart = Math.max(0, sleepStart - windDownMin);
  const awakeWindowMin = windDownStart;

  const clippedCommitments = day.commitments
    .map((c) => {
      const s = timeToOffset(wakeMin, c.startTime);
      const dur = durationBetweenHHMM(c.startTime, c.endTime);
      return {
        start: Math.max(0, s),
        end: Math.min(windDownStart, s + dur),
      };
    })
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let fixedCommitmentMin = 0;
  let mergedStart = -1;
  let mergedEnd = -1;
  for (const iv of clippedCommitments) {
    if (mergedEnd === -1) {
      mergedStart = iv.start;
      mergedEnd = iv.end;
    } else if (iv.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, iv.end);
    } else {
      fixedCommitmentMin += mergedEnd - mergedStart;
      mergedStart = iv.start;
      mergedEnd = iv.end;
    }
  }
  if (mergedEnd !== -1) {
    fixedCommitmentMin += mergedEnd - mergedStart;
  }

  const availableMin = Math.max(0, awakeWindowMin - fixedCommitmentMin);

  let scheduledMin = 0;
  let todoMin = 0;
  let doneMin = 0;
  let deepWorkPlannedMin = 0;

  for (const b of day.blocks ?? []) {
    if (b.status === "skipped") continue;
    const mins = Math.max(0, Math.round(b.plannedMin));
    if (b.status === "scheduled") scheduledMin += mins;
    else if (b.status === "todo") todoMin += mins;
    else if (b.status === "done") doneMin += mins;

    if (b.kind === "deep") {
      deepWorkPlannedMin += mins;
    }
  }

  const remainingTimelineMin = Math.max(0, availableMin - scheduledMin - doneMin);
  const remainingWithTodoMin = Math.max(
    0,
    availableMin - scheduledMin - todoMin - doneMin,
  );

  return {
    awakeWindowMin,
    fixedCommitmentMin,
    availableMin,
    scheduledMin,
    todoMin,
    doneMin,
    remainingTimelineMin,
    remainingWithTodoMin,
    deepWorkPlannedMin,
    deepWorkCapMin,
    deepWorkRemainingMin: Math.max(0, deepWorkCapMin - deepWorkPlannedMin),
    exceedsDeepWorkCap: deepWorkPlannedMin > deepWorkCapMin,
  };
}
