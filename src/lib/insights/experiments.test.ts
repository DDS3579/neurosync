import { describe, expect, it } from 'vitest';
import type { DailyCheckin, Experiment, FocusSession, InsightInput, ISODate, Rating } from '@/types/domain';
import { analyzeExperiment } from './experiments';

let seq = 0;
const base = () => ({ id: `t${++seq}`, createdAt: '2026-11-01T08:00:00', updatedAt: '2026-11-01T08:00:00' });
const settings = () => ({ ...base(), sleepTargetMin: 480, focusDefaultMin: 25, breakDefaultMin: 5, onboarded: true, schemaVersion: 1 });
const checkin = (date: ISODate, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  ...base(), date, mood: 3, stress: 3, energy: 3, concentration: 3, motivation: 3, ...over,
});
const focusLog = (date: ISODate, focusRating: Rating, hour = '09'): FocusSession => ({
  ...base(), date, startedAt: `${date}T${hour}:00:00`, durationMin: 25, plannedMin: 25, subject: 'test',
  method: 'deep_reading', focusRating, difficulty: 3, distractions: 0,
});
const experiment = (over: Partial<Experiment> = {}): Experiment => ({
  ...base(), title: 'Test', hypothesis: 'h', changeDescription: 'c', metric: 'concentration',
  baselineStart: '2026-11-01', baselineEnd: '2026-11-07', interventionStart: '2026-11-08', interventionEnd: '2026-11-14',
  status: 'complete', ...over,
});
const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  settings: settings(), sleep: [], checkins: [], focus: [], movement: [], nutrition: [], habits: [], habitLogs: [], ...over,
});
const days = (start: number, count: number): ISODate[] =>
  Array.from({ length: count }, (_, i) => `2026-11-${String(start + i).padStart(2, '0')}`);
const REQUIRED_CAVEATS = [/causation/i, /self-reported/i, /other things changed/i];

describe('analyzeExperiment — insufficient data', () => {
  it('returns nulls and unknown direction for empty input, with all required caveats', () => {
    const r = analyzeExperiment(experiment(), input());
    expect(r.baseline).toEqual({ n: 0, mean: null });
    expect(r.intervention).toEqual({ n: 0, mean: null });
    expect(r.difference).toBeNull();
    expect(r.sufficientData).toBe(false);
    expect(r.direction).toBe('unknown');
    for (const pattern of REQUIRED_CAVEATS) {
      expect(r.caveats.some((c) => pattern.test(c))).toBe(true);
    }
  });

  it('stays unknown with 4 baseline days even when the difference looks large', () => {
    const checkins = [
      ...days(1, 4).map((d) => checkin(d, { concentration: 2 })),
      ...days(8, 6).map((d) => checkin(d, { concentration: 4 })),
    ];
    const r = analyzeExperiment(experiment(), input({ checkins }));
    expect(r.sufficientData).toBe(false);
    expect(r.direction).toBe('unknown');
    expect(r.summary).toMatch(/provisional/);
    expect(r.caveats.length).toBe(4); // extra small-sample caveat
    expect(r.effectSizeNote).toBeUndefined();
  });

  it('boundary: exactly 5 days in each period is sufficient; 5 and 4 is not', () => {
    const five = days(1, 5).map((d) => checkin(d));
    const fiveI = days(8, 5).map((d) => checkin(d));
    expect(analyzeExperiment(experiment(), input({ checkins: [...five, ...fiveI] })).sufficientData).toBe(true);
    const fourI = days(8, 4).map((d) => checkin(d));
    expect(analyzeExperiment(experiment(), input({ checkins: [...five, ...fourI] })).sufficientData).toBe(false);
  });
});

describe('analyzeExperiment — directions and wording', () => {
  it('reports a higher concentration rating neutrally', () => {
    // Both periods need real day-to-day variation: with zero variance the
    // "times your usual variation" ratio would be undefined.
    const baseline: Rating[] = [1, 2, 2, 2, 3];
    const intervention: Rating[] = [3, 4, 4, 4, 5];
    const checkins = [
      ...days(1, 5).map((d, i) => checkin(d, { concentration: baseline[i] })),
      ...days(8, 5).map((d, i) => checkin(d, { concentration: intervention[i] })),
    ];
    const r = analyzeExperiment(experiment(), input({ checkins }));
    expect(r.difference).toBe(2);
    expect(r.direction).toBe('higher');
    expect(r.summary).toContain('higher concentration rating');
    expect(r.effectSizeNote).toBeDefined();
    expect(r.effectSizeNote).toContain('not a verdict');
  });

  it('describes lower stress as a lower stress rating — never good or bad', () => {
    const checkins = [...days(1, 5).map((d) => checkin(d, { stress: 4 })), ...days(8, 5).map((d) => checkin(d, { stress: 2 }))];
    const r = analyzeExperiment(experiment({ metric: 'stress' }), input({ checkins }));
    expect(r.direction).toBe('lower');
    expect(r.summary).toContain('lower stress rating');
    expect(r.summary).not.toMatch(/\bgood\b|\bbad\b|\bimprove|\bworse|\bbetter\b/i);
  });

  it('calls differences within ±0.3 similar', () => {
    const checkins = [...days(1, 5).map((d) => checkin(d)), ...days(8, 5).map((d, i) => checkin(d, { concentration: i === 4 ? 4 : 3 }))];
    const r = analyzeExperiment(experiment(), input({ checkins }));
    expect(r.difference).toBe(0.2);
    expect(r.direction).toBe('similar');
  });

  it('always includes the three required caveats, on every path', () => {
    const results = [
      analyzeExperiment(experiment(), input()),
      analyzeExperiment(experiment(), input({ checkins: days(1, 2).map((d) => checkin(d)) })),
      analyzeExperiment(experiment(), input({ checkins: [...days(1, 5), ...days(8, 5)].map((d) => checkin(d)) })),
    ];
    for (const r of results) {
      for (const pattern of REQUIRED_CAVEATS) expect(r.caveats.some((c) => pattern.test(c))).toBe(true);
    }
  });
});

describe('analyzeExperiment — series construction', () => {
  it('averages focus sessions per day and counts days, not sessions', () => {
    const focus = [
      ...days(1, 5).flatMap((d) => [focusLog(d, 2), focusLog(d, 4, '16')]), // daily mean 3
      ...days(8, 5).map((d) => focusLog(d, 5)),
    ];
    const r = analyzeExperiment(experiment({ metric: 'focusRating' }), input({ focus }));
    expect(r.baseline.n).toBe(5); // 10 sessions → 5 days
    expect(r.baseline.mean).toBe(3);
    expect(r.difference).toBe(2);
    expect(r.direction).toBe('higher');
  });

  it('includes range edge dates and excludes days outside the ranges', () => {
    const checkins = [
      checkin('2026-10-31'), checkin('2026-11-01'), checkin('2026-11-07'), // baseline: 2 inside
      checkin('2026-11-08'), checkin('2026-11-14'), checkin('2026-11-15'), // intervention: 2 inside
    ];
    const r = analyzeExperiment(experiment(), input({ checkins }));
    expect(r.baseline.n).toBe(2);
    expect(r.intervention.n).toBe(2);
  });

  it('never mutates input (deep-frozen works)', () => {
    const data = input({ checkins: [...days(1, 5), ...days(8, 5)].map((d) => checkin(d, { concentration: 4 })) });
    const expected = analyzeExperiment(experiment(), data);
    const freeze = (v: unknown): void => {
      if (v !== null && typeof v === 'object') {
        Object.freeze(v);
        for (const x of Object.values(v as Record<string, unknown>)) freeze(x);
      }
    };
    freeze(data);
    expect(analyzeExperiment(experiment(), data)).toEqual(expected);
  });
});
