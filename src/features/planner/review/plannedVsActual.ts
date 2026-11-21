import type { Block, BlockStatus, ISODate, Task, TaskKind } from "@/types/domain";
import { formatMinutes } from "@/features/planner/dayContext";

export const MIN_ESTIMATION_SAMPLES = 6;
export const ESTIMATION_MIN_DELTA_MIN = 5;

export const REVIEW_KIND_ORDER: readonly TaskKind[] = ["deep", "shallow", "recovery"];
export const REVIEW_KIND_LABEL: Record<TaskKind, string> = {
  deep: "Deep",
  shallow: "Shallow",
  recovery: "Recovery",
};

export const PLANNED_VS_ACTUAL_CAVEAT =
  "Self-logged durations from your own timer. These are self-reported numbers over the blocks you happened to complete — they describe your logs, they do not measure ability, and they cannot show what caused a difference.";

export interface BlockReviewSample {
  id: string;
  kind: TaskKind;
  plannedMin: number;
  status: BlockStatus;
  actualMin?: number;
  plannedDate?: ISODate;
  focusSessionId?: string;
}

/** Joins blocks to their task kind. Blocks whose task is gone fall back to shallow. */
export function collectBlockSamples(
  blocks: readonly Block[],
  tasks: readonly Task[],
): BlockReviewSample[] {
  const kindByTaskId = new Map(tasks.map((task) => [task.id, task.kind]));
  return blocks.map((block) => ({
    id: block.id,
    kind: kindByTaskId.get(block.taskId) ?? "shallow",
    plannedMin: Math.max(0, Math.round(block.plannedMin)),
    status: block.status,
    ...(typeof block.actualMin === "number" && Number.isFinite(block.actualMin)
      ? { actualMin: Math.max(0, Math.round(block.actualMin)) }
      : {}),
    ...(block.plannedDate ? { plannedDate: block.plannedDate } : {}),
    ...(block.focusSessionId ? { focusSessionId: block.focusSessionId } : {}),
  }));
}

export interface PlannedActualGroup {
  key: string;
  label: string;
  n: number;
  plannedTotalMin: number;
  actualTotalMin: number;
  avgPlannedMin: number;
  avgActualMin: number;
  /** Average logged minus average planned. Positive means blocks ran longer. */
  deltaMin: number;
}

export interface PlannedActualReport {
  range: { start: ISODate; end: ISODate } | null;
  totalBlocks: number;
  doneBlocks: number;
  measuredBlocks: number;
  unmeasuredDoneBlocks: number;
  skippedBlocks: number;
  openBlocks: number;
  plannedMin: number;
  actualTotalMin: number;
  overall: PlannedActualGroup | null;
  byLength: PlannedActualGroup[];
  byKind: PlannedActualGroup[];
  summaryLine: string;
  caveats: string[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Length buckets are the planned length rounded to 5 minutes: 25m, 50m, 90m… */
export function lengthBucket(plannedMin: number): number {
  return Math.max(5, Math.round(Math.max(0, plannedMin) / 5) * 5);
}

function group(
  key: string,
  label: string,
  rows: readonly { planned: number; actual: number }[],
): PlannedActualGroup | null {
  if (rows.length === 0) return null;
  const plannedTotalMin = rows.reduce((sum, row) => sum + row.planned, 0);
  const actualTotalMin = rows.reduce((sum, row) => sum + row.actual, 0);
  const avgPlanned = plannedTotalMin / rows.length;
  const avgActual = actualTotalMin / rows.length;
  return {
    key,
    label,
    n: rows.length,
    plannedTotalMin,
    actualTotalMin,
    avgPlannedMin: round1(avgPlanned),
    avgActualMin: round1(avgActual),
    deltaMin: round1(avgActual - avgPlanned),
  };
}

/**
 * Descriptive planned-vs-actual aggregation. Only completed blocks with a real
 * logged duration enter the averages; completed blocks without one are counted
 * separately so nothing is silently treated as "on time".
 */
export function buildPlannedActualReport(
  samples: readonly BlockReviewSample[],
  options: { range?: { start: ISODate; end: ISODate } } = {},
): PlannedActualReport {
  const range = options.range ?? null;
  const inRange = samples.filter((sample) => {
    if (!range) return true;
    if (!sample.plannedDate) return false;
    return sample.plannedDate >= range.start && sample.plannedDate <= range.end;
  });

  let doneBlocks = 0;
  let skippedBlocks = 0;
  let openBlocks = 0;
  let unmeasuredDoneBlocks = 0;
  let plannedMin = 0;

  const measured: Array<BlockReviewSample & { actualMin: number }> = [];
  for (const sample of inRange) {
    if (sample.status === "skipped") {
      skippedBlocks += 1;
      continue;
    }
    plannedMin += sample.plannedMin;
    if (sample.status === "done") {
      doneBlocks += 1;
      if (typeof sample.actualMin === "number") {
        measured.push({ ...sample, actualMin: sample.actualMin });
      } else {
        unmeasuredDoneBlocks += 1;
      }
    } else {
      openBlocks += 1;
    }
  }

  const rows = measured.map((sample) => ({
    planned: sample.plannedMin,
    actual: sample.actualMin,
  }));
  const overall = group("all", "All measured blocks", rows);

  const byLengthMap = new Map<number, Array<{ planned: number; actual: number }>>();
  const byKindMap = new Map<TaskKind, Array<{ planned: number; actual: number }>>();
  for (const sample of measured) {
    const bucket = lengthBucket(sample.plannedMin);
    const lengthRows = byLengthMap.get(bucket) ?? [];
    lengthRows.push({ planned: sample.plannedMin, actual: sample.actualMin });
    byLengthMap.set(bucket, lengthRows);
    const kindRows = byKindMap.get(sample.kind) ?? [];
    kindRows.push({ planned: sample.plannedMin, actual: sample.actualMin });
    byKindMap.set(sample.kind, kindRows);
  }

  const byLength = [...byLengthMap.keys()]
    .sort((a, b) => a - b)
    .map((bucket) => group(`len:${bucket}`, `${bucket}m blocks`, byLengthMap.get(bucket)!))
    .filter((entry): entry is PlannedActualGroup => entry !== null);

  const byKind = REVIEW_KIND_ORDER.map((kind) =>
    group(`kind:${kind}`, REVIEW_KIND_LABEL[kind], byKindMap.get(kind) ?? []),
  ).filter((entry): entry is PlannedActualGroup => entry !== null);

  const actualTotalMin = measured.reduce((sum, sample) => sum + sample.actualMin, 0);
  const summaryLine = overall
    ? `Planned ${formatMinutes(overall.avgPlannedMin)} · logged ${formatMinutes(
        overall.avgActualMin,
      )} on average · n = ${overall.n} ${overall.n === 1 ? "block" : "blocks"}`
    : "No completed blocks with a logged duration in this window yet.";

  const caveats = [PLANNED_VS_ACTUAL_CAVEAT];
  if (unmeasuredDoneBlocks > 0) {
    caveats.push(
      `${unmeasuredDoneBlocks} completed ${
        unmeasuredDoneBlocks === 1 ? "block has" : "blocks have"
      } no logged duration, so ${
        unmeasuredDoneBlocks === 1 ? "it is" : "they are"
      } left out of the averages rather than assumed to match the plan.`,
    );
  }

  return {
    range,
    totalBlocks: inRange.length,
    doneBlocks,
    measuredBlocks: measured.length,
    unmeasuredDoneBlocks,
    skippedBlocks,
    openBlocks,
    plannedMin,
    actualTotalMin,
    overall,
    byLength,
    byKind,
    summaryLine,
    caveats,
  };
}

/**
 * The length bucket with the largest average gap that still clears the minimum
 * sample size. Deterministic: biggest |delta|, then most blocks, then shortest.
 */
export function pickEstimationPattern(
  report: PlannedActualReport,
  minSamples: number = MIN_ESTIMATION_SAMPLES,
  minDeltaMin: number = ESTIMATION_MIN_DELTA_MIN,
): PlannedActualGroup | null {
  const eligible = report.byLength.filter(
    (entry) => entry.n >= minSamples && Math.abs(entry.deltaMin) >= minDeltaMin,
  );
  if (eligible.length === 0) return null;
  return [...eligible].sort(
    (a, b) =>
      Math.abs(b.deltaMin) - Math.abs(a.deltaMin) ||
      b.n - a.n ||
      a.avgPlannedMin - b.avgPlannedMin,
  )[0]!;
}
