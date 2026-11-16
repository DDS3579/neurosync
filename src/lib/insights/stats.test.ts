import { describe, expect, it } from 'vitest';
import {
  circularMeanMinutes,
  circularStdMinutes,
  clamp,
  groupByDate,
  linearSlope,
  mean,
  median,
  pairByDate,
  pearson,
  round1,
  stdDev,
  type DateValue,
} from './stats';

describe('mean', () => {
  it('computes the arithmetic mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
  it('returns null on empty input', () => {
    expect(mean([])).toBeNull();
  });
});

describe('median', () => {
  it('handles odd-length unsorted input without mutating it', () => {
    const frozen = Object.freeze([3, 1, 2]);
    expect(median(frozen)).toBe(2);
  });
  it('averages the middle pair for even-length input', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('returns null on empty input', () => {
    expect(median([])).toBeNull();
  });
});

describe('stdDev (population)', () => {
  it('matches the classic worked example', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
  it('returns 0 for a single value and null for empty', () => {
    expect(stdDev([7])).toBe(0);
    expect(stdDev([])).toBeNull();
  });
});

describe('pearson', () => {
  it('returns +1 for a perfectly increasing linear relation (n = 5)', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBe(1);
  });
  it('returns −1 for a perfectly decreasing relation', () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBe(-1);
  });
  it('computes a known intermediate value', () => {
    const r = pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    expect(r).toBeCloseTo(0.774597, 5);
  });
  it('returns null when n < 5 even for a perfect relation (boundary: 4 pairs)', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeNull();
  });
  it('returns null when either series has zero variance', () => {
    expect(pearson([3, 3, 3, 3, 3], [1, 2, 3, 4, 5])).toBeNull();
    expect(pearson([1, 2, 3, 4, 5], [7, 7, 7, 7, 7])).toBeNull();
  });
  it('returns null on mismatched lengths', () => {
    expect(pearson([1, 2, 3, 4, 5], [1, 2, 3])).toBeNull();
  });
});

describe('linearSlope', () => {
  it('recovers positive and negative slopes', () => {
    expect(linearSlope([0, 1, 2, 3], [1, 3, 5, 7])).toBe(2);
    expect(linearSlope([0, 1, 2, 3], [7, 5, 3, 1])).toBe(-2);
  });
  it('returns null for n < 2, zero x-variance, or mismatched lengths', () => {
    expect(linearSlope([1], [5])).toBeNull();
    expect(linearSlope([2, 2, 2], [1, 2, 3])).toBeNull();
    expect(linearSlope([1, 2], [1])).toBeNull();
  });
});

describe('groupByDate', () => {
  it('groups items by date and never mutates frozen input', () => {
    const items = Object.freeze([
      Object.freeze({ date: '2026-11-10', v: 1 }),
      Object.freeze({ date: '2026-11-11', v: 2 }),
      Object.freeze({ date: '2026-11-10', v: 3 }),
    ]);
    const grouped = groupByDate(items);
    expect(grouped.get('2026-11-10')?.map((i) => i.v)).toEqual([1, 3]);
    expect(grouped.get('2026-11-11')?.map((i) => i.v)).toEqual([2]);
    expect(grouped.get('2026-11-12')).toBeUndefined();
  });
});

describe('pairByDate', () => {
  it('inner-joins on date, averages duplicates, and sorts ascending', () => {
    const a: DateValue[] = [
      { date: '2026-11-12', value: 5 },
      { date: '2026-11-10', value: 10 },
      { date: '2026-11-10', value: 20 },
    ];
    const b: DateValue[] = [
      { date: '2026-11-13', value: 9 },
      { date: '2026-11-10', value: 3 },
      { date: '2026-11-12', value: 7 },
    ];
    expect(pairByDate(a, b)).toEqual([
      { date: '2026-11-10', x: 15, y: 3 },
      { date: '2026-11-12', x: 5, y: 7 },
    ]);
  });
  it('returns [] when there is no date overlap', () => {
    expect(
      pairByDate([{ date: '2026-11-10', value: 1 }], [{ date: '2026-11-11', value: 2 }]),
    ).toEqual([]);
  });
});

describe('circularMeanMinutes (midnight wrap)', () => {
  it('averages 23:30 and 00:30 to midnight, not noon', () => {
    expect(circularMeanMinutes([1410, 30])).toBeCloseTo(0, 6);
  });
  it('averages 23:00 and 01:00 to midnight', () => {
    expect(circularMeanMinutes([1380, 60])).toBeCloseTo(0, 6);
  });
  it('matches the linear mean when no wrap is involved', () => {
    expect(circularMeanMinutes([60, 120])).toBeCloseTo(90, 6);
  });
  it('normalizes out-of-range minutes before averaging', () => {
    expect(circularMeanMinutes([1470, 60])).toBeCloseTo(45, 6); // 1470 ≡ 30
  });
  it('returns the value itself for one point and null for none', () => {
    expect(circularMeanMinutes([500])).toBe(500);
    expect(circularMeanMinutes([])).toBeNull();
  });
});

describe('circularStdMinutes (midnight wrap)', () => {
  it('treats 23:30 and 00:30 as ~30 min of spread, not ~690', () => {
    const sd = circularStdMinutes([1410, 30]);
    expect(sd).toBeCloseTo(30, 0);
    expect(sd).toBeLessThan(60);
  });
  it('returns 0 for identical times and for a single time', () => {
    expect(circularStdMinutes([1410, 1410, 1410, 1410, 1410])).toBe(0);
    expect(circularStdMinutes([500])).toBe(0);
  });
  it('caps near-antipodal times at 720 (finite, interpretable)', () => {
    expect(circularStdMinutes([0, 720])).toBe(720);
  });
  it('returns null on empty input', () => {
    expect(circularStdMinutes([])).toBeNull();
  });
});

describe('clamp / round1', () => {
  it('clamps to bounds and passes through in-range values', () => {
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
  it('rounds to one decimal', () => {
    expect(round1(3.14159)).toBe(3.1);
    expect(round1(2.25)).toBe(2.3);
  });
});
