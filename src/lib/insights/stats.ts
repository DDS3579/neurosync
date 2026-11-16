import type { ISODate } from '@/types/domain';

/**
 * Pure descriptive statistics for the insight engine.
 * Empty inputs return null (never NaN); inputs are never mutated.
 * All functions assume finite numbers (Zod validates at the repository boundary).
 */

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return lo === undefined || hi === undefined ? null : (lo + hi) / 2;
}

/** Population standard deviation (descriptive stats over the user's own logs, not a sample estimate). */
export function stdDev(xs: readonly number[]): number | null {
  const m = mean(xs);
  if (m === null) return null;
  let sumSq = 0;
  for (const x of xs) sumSq += (x - m) ** 2;
  return Math.sqrt(sumSq / xs.length);
}

/** Pearson r. Null when n < 5, lengths differ, or either series has (near-)zero variance. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const mx = mean(xs);
  const my = mean(ys);
  if (mx === null || my === null) return null;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [i, x] of xs.entries()) {
    const y = ys[i];
    if (y === undefined) return null;
    const dx = x - mx;
    const dy = y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  // Absolute epsilon also catches fp dust left over from constant series.
  if (sxx < 1e-12 || syy < 1e-12) return null;
  return clamp(sxy / Math.sqrt(sxx * syy), -1, 1); // guard fp overshoot past ±1
}

/** Least-squares slope of ys over xs. Null when n < 2, lengths differ, or x has zero variance. */
export function linearSlope(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  if (mx === null || my === null) return null;
  let sxy = 0;
  let sxx = 0;
  for (const [i, x] of xs.entries()) {
    const y = ys[i];
    if (y === undefined) return null;
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  if (sxx < 1e-12) return null;
  return sxy / sxx;
}

/** Groups items by their ISODate. Insertion order preserved; items are referenced, never cloned or mutated. */
export function groupByDate<T extends { date: ISODate }>(items: readonly T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const item of items) {
    const bucket = out.get(item.date);
    if (bucket) bucket.push(item);
    else out.set(item.date, [item]);
  }
  return out;
}

export interface DateValue {
  date: ISODate;
  value: number;
}

export interface DatePair {
  date: ISODate;
  x: number;
  y: number;
}

/**
 * Inner join of two numeric series on ISODate.
 * Duplicate dates on either side are averaged; output is sorted ascending by date,
 * so the result is independent of input ordering.
 */
export function pairByDate(a: readonly DateValue[], b: readonly DateValue[]): DatePair[] {
  const summarize = (points: readonly DateValue[]): Map<ISODate, { sum: number; count: number }> => {
    const m = new Map<ISODate, { sum: number; count: number }>();
    for (const p of points) {
      const cur = m.get(p.date);
      if (cur) {
        cur.sum += p.value;
        cur.count += 1;
      } else {
        m.set(p.date, { sum: p.value, count: 1 });
      }
    }
    return m;
  };
  const ma = summarize(a);
  const mb = summarize(b);
  const out: DatePair[] = [];
  for (const [date, xa] of ma) {
    const yb = mb.get(date);
    if (yb !== undefined) out.push({ date, x: xa.sum / xa.count, y: yb.sum / yb.count });
  }
  // 'YYYY-MM-DD' strings compare lexicographically in chronological order.
  out.sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : 0));
  return out;
}

const MINUTES_PER_DAY = 1440;
const TWO_PI = Math.PI * 2;
const RAD_TO_MINUTES = MINUTES_PER_DAY / TWO_PI;

const wrapMinutes = (m: number): number => ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

function resultant(minutes: readonly number[]): { c: number; s: number; r: number } | null {
  if (minutes.length === 0) return null;
  let c = 0;
  let s = 0;
  for (const m of minutes) {
    const theta = (wrapMinutes(m) / MINUTES_PER_DAY) * TWO_PI;
    c += Math.cos(theta);
    s += Math.sin(theta);
  }
  c /= minutes.length;
  s /= minutes.length;
  return { c, s, r: Math.hypot(c, s) };
}

/**
 * Circular mean of minutes-of-day, in [0, 1440). Handles midnight wrap:
 * 23:30 (1410) and 00:30 (30) average to 00:00, not 12:00.
 */
export function circularMeanMinutes(minutes: readonly number[]): number | null {
  const res = resultant(minutes);
  if (res === null) return null;
  const angle = Math.atan2(res.s, res.c); // -π..π
  const raw = wrapMinutes(angle * RAD_TO_MINUTES);
  // fp can turn a true-midnight mean into 1439.9999999…; snap it back to 0.
  return MINUTES_PER_DAY - raw < 1e-6 ? 0 : raw;
}

/**
 * Circular standard deviation in minutes (Mardia & Jupp: sqrt(-2 ln R), converted to minutes).
 * Capped at 720 (half a day) so near-antipodal times yield a finite, interpretable spread
 * instead of the formula's unbounded limit as R → 0.
 */
export function circularStdMinutes(minutes: readonly number[]): number | null {
  const res = resultant(minutes);
  if (res === null) return null;
  if (res.r >= 1 - 1e-12) return 0; // identical times (R may be 0.999… in fp)
  if (res.r <= 1e-12) return 720; // opposite clock faces: maximal practical spread
  return Math.min(720, Math.sqrt(-2 * Math.log(res.r)) * RAD_TO_MINUTES);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
