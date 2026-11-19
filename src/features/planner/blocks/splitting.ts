import type { BlockStatus } from "@/types/domain";

export const MIN_BLOCK_MIN = 15;
export const MIN_MANUAL_BLOCK_PART_MIN = 5;

export interface BlockSplitLike {
  id: string;
  taskId: string;
  order: number;
  plannedMin: number;
  status: BlockStatus;
  plannedDate?: string;
  plannedStart?: string;
}

export type BlockMutationResult<T extends BlockSplitLike> =
  | { ok: true; blocks: T[] }
  | { ok: false; error: string };

function roundToNearest5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

/**
 * Splits `estimateMin` into `ceil(estimate / blockLen)` blocks where the final block
 * takes the remainder rounded to the nearest 5 minutes (minimum 15 minutes).
 */
export function splitIntoBlocks(estimateMin: number, blockLen: number = 50): number[] {
  if (!Number.isFinite(estimateMin) || estimateMin <= 0) return [];
  const safeEstimate = Math.round(estimateMin);
  const safeBlockLen = Math.max(
    MIN_BLOCK_MIN,
    Math.round(Number.isFinite(blockLen) ? blockLen : 50),
  );

  const count = Math.ceil(safeEstimate / safeBlockLen);
  if (count <= 1) {
    return [Math.max(MIN_BLOCK_MIN, roundToNearest5(safeEstimate))];
  }

  const parts: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    parts.push(safeBlockLen);
  }
  const remainder = safeEstimate - (count - 1) * safeBlockLen;
  parts.push(Math.max(MIN_BLOCK_MIN, roundToNearest5(remainder)));
  return parts;
}

function normalizeTaskOrders<T extends BlockSplitLike>(blocks: T[], taskId: string): T[] {
  let order = 0;
  return blocks.map((block) => {
    if (block.taskId !== taskId) return block;
    const next = { ...block, order };
    order += 1;
    return next;
  });
}

function makeDefaultId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Manually splits one uncompleted block into two parts whose durations sum
 * strictly to the original block's `plannedMin`.
 */
export function manualSplitBlock<T extends BlockSplitLike>(
  blocks: readonly T[],
  blockId: string,
  firstPartMin: number,
  options: { minPartMin?: number; makeId?: () => string } = {},
): BlockMutationResult<T> {
  const minPart = Math.max(1, options.minPartMin ?? MIN_MANUAL_BLOCK_PART_MIN);
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) {
    return { ok: false, error: "Block not found." };
  }

  const target = blocks[idx]!;
  if (target.status === "done" || target.status === "skipped") {
    return { ok: false, error: "Completed or skipped blocks cannot be split." };
  }
  if (!Number.isFinite(firstPartMin)) {
    return { ok: false, error: "Split duration must be a valid number." };
  }

  const firstMin = Math.round(firstPartMin);
  const secondMin = target.plannedMin - firstMin;
  if (firstMin < minPart || secondMin < minPart) {
    return {
      ok: false,
      error: `Each split block must be at least ${minPart} minutes.`,
    };
  }

  const firstBlock: T = { ...target, plannedMin: firstMin };
  const secondBlock: T = {
    ...target,
    id: (options.makeId ?? makeDefaultId)(),
    plannedMin: secondMin,
    // Place the new sibling into Day To-Do (if dated) or Tray so it never overlaps on the timeline.
    status: target.status === "scheduled" ? "todo" : target.status,
    plannedStart: undefined,
  };

  const next = [...blocks.slice(0, idx), firstBlock, secondBlock, ...blocks.slice(idx + 1)];
  return { ok: true, blocks: normalizeTaskOrders(next, target.taskId) };
}

/**
 * Merges two uncompleted blocks belonging to the same task into one block,
 * preserving the task's total `plannedMin`.
 */
export function mergeBlocks<T extends BlockSplitLike>(
  blocks: readonly T[],
  firstBlockId: string,
  secondBlockId: string,
): BlockMutationResult<T> {
  if (firstBlockId === secondBlockId) {
    return { ok: false, error: "Choose two different blocks to merge." };
  }

  const firstIdx = blocks.findIndex((b) => b.id === firstBlockId);
  const secondIdx = blocks.findIndex((b) => b.id === secondBlockId);
  if (firstIdx === -1 || secondIdx === -1) {
    return { ok: false, error: "Both blocks must exist to merge." };
  }

  const first = blocks[firstIdx]!;
  const second = blocks[secondIdx]!;
  if (first.taskId !== second.taskId) {
    return { ok: false, error: "Only blocks from the same task can be merged." };
  }
  if (
    first.status === "done" ||
    first.status === "skipped" ||
    second.status === "done" ||
    second.status === "skipped"
  ) {
    return { ok: false, error: "Completed or skipped blocks cannot be merged." };
  }

  const merged: T = {
    ...first,
    plannedMin: first.plannedMin + second.plannedMin,
  };

  const next = blocks
    .map((b) => (b.id === first.id ? merged : b))
    .filter((b) => b.id !== second.id);

  return { ok: true, blocks: normalizeTaskOrders(next, first.taskId) };
}

/**
 * Resizes a block while shifting the opposing delta onto a sibling block of the
 * same task so the task's total planned minutes stay unchanged.
 */
export function resizeBlockPreservingTotal<T extends BlockSplitLike>(
  blocks: readonly T[],
  targetBlockId: string,
  nextPlannedMin: number,
  options: { companionBlockId?: string; minBlockMin?: number } = {},
): BlockMutationResult<T> {
  const minBlockMin = Math.max(1, options.minBlockMin ?? MIN_MANUAL_BLOCK_PART_MIN);
  const target = blocks.find((b) => b.id === targetBlockId);
  if (!target) {
    return { ok: false, error: "Block not found." };
  }
  if (target.status === "done" || target.status === "skipped") {
    return { ok: false, error: "Completed or skipped blocks cannot be resized." };
  }
  if (!Number.isFinite(nextPlannedMin)) {
    return { ok: false, error: "Duration must be a valid number." };
  }

  const roundedNext = Math.round(nextPlannedMin);
  if (roundedNext < minBlockMin) {
    return { ok: false, error: `Block duration must be at least ${minBlockMin} minutes.` };
  }

  const delta = roundedNext - target.plannedMin;
  if (delta === 0) {
    return { ok: true, blocks: [...blocks] };
  }

  const editableSiblings = blocks
    .filter(
      (b) =>
        b.taskId === target.taskId &&
        b.id !== target.id &&
        b.status !== "done" &&
        b.status !== "skipped",
    )
    .sort((a, b) => a.order - b.order);

  const companion = options.companionBlockId
    ? editableSiblings.find((b) => b.id === options.companionBlockId)
    : (editableSiblings.find((b) => b.order > target.order) ?? editableSiblings[0]);

  if (!companion) {
    return {
      ok: false,
      error: "Another uncompleted sibling block is required to preserve the task total.",
    };
  }

  const nextCompanionMin = companion.plannedMin - delta;
  if (nextCompanionMin < minBlockMin) {
    return {
      ok: false,
      error: `Cannot shrink sibling block below ${minBlockMin} minutes while preserving total.`,
    };
  }

  const next = blocks.map((b) => {
    if (b.id === target.id) return { ...b, plannedMin: roundedNext };
    if (b.id === companion.id) return { ...b, plannedMin: nextCompanionMin };
    return b;
  });

  return { ok: true, blocks: next };
}
