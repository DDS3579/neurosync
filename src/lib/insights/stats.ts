/** Small deterministic statistics helpers shared by the insight engine. */

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];

  if (lower === undefined || upper === undefined) return null;
  return (lower + upper) / 2;
}

export function standardDeviation(values: readonly number[]): number | null {
  const average = mean(values);
  if (average === null) return null;

  const variance = mean(values.map((value) => (value - average) ** 2));
  if (variance === null) return null;

  return Math.sqrt(variance);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Percentage change of `to` relative to `from`, or null when not meaningful. */
export function percentChange(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return roundTo(((to - from) / Math.abs(from)) * 100, 1);
}

export function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}
