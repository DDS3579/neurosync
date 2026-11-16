import { describe, expect, it } from 'vitest';
import { format, getDay, parseISO, subDays } from 'date-fns';
import type { Rating } from '@/types/domain';
import { mean, pearson } from './stats';
import { generateDemoData } from './demo';

const TODAY = parseISO('2026-11-16'); // local midnight, timezone-stable
const TODAY_ISO = '2026-11-16';
const isRating = (x: number): boolean => Number.isInteger(x) && x >= 1 && x <= 5;

describe('generateDemoData — determinism', () => {
  it('produces identical output for the same seed and day', () => {
    expect(generateDemoData(30, 42, TODAY)).toEqual(generateDemoData(30, 42, TODAY));
  });

  it('differs for a different seed', () => {
    expect(JSON.stringify(generateDemoData(30, 42, TODAY))).not.toBe(JSON.stringify(generateDemoData(30, 7, TODAY)));
  });

  it('ignores time-of-day of the today parameter', () => {
    expect(generateDemoData(20, 42, new Date(2026, 10, 16, 9, 0))).toEqual(generateDemoData(20, 42, new Date(2026, 10, 16, 23, 59)));
  });

  it('uses stable demo- ids and dates ending today', () => {
    const data = generateDemoData(90, 42, TODAY);
    const all = [data.settings, ...data.sleep, ...data.checkins, ...data.focus, ...data.movement, ...data.nutrition, ...data.habits, ...data.habitLogs];
    for (const entity of all) expect(entity.id.startsWith('demo-')).toBe(true);
    expect(data.sleep).toHaveLength(90);
    const last = data.sleep[data.sleep.length - 1];
    const first = data.sleep[0];
    expect(last?.date).toBe(TODAY_ISO);
    expect(first?.date).toBe(format(subDays(TODAY, 89), 'yyyy-MM-dd'));
  });

  it('returns empty logs (but settings and 4 habits) for zero days', () => {
    const data = generateDemoData(0, 42, TODAY);
    expect(data.sleep).toEqual([]);
    expect(data.checkins).toEqual([]);
    expect(data.focus).toEqual([]);
    expect(data.habitLogs).toEqual([]);
    expect(data.habits).toHaveLength(4);
    expect(data.settings.sleepTargetMin).toBe(480);
  });
});

describe('generateDemoData — realism', () => {
  const d60 = generateDemoData(60, 42, TODAY);
  const d90 = generateDemoData(90, 42, TODAY);

  it('hits the target logging rates', () => {
    const focusDays = new Set(d60.focus.map((s) => s.date)).size;
    const movementDays = new Set(d60.movement.map((m) => m.date)).size;
    expect(d60.checkins.length / 60).toBeGreaterThanOrEqual(0.75);
    expect(d60.checkins.length / 60).toBeLessThanOrEqual(0.97);
    expect(focusDays / 60).toBeGreaterThanOrEqual(0.55);
    expect(focusDays / 60).toBeLessThanOrEqual(0.85);
    expect(movementDays / 60).toBeGreaterThanOrEqual(0.4); // ~4 days/week
    expect(movementDays / 60).toBeLessThanOrEqual(0.72);
    expect(d60.nutrition.length / 60).toBeGreaterThanOrEqual(0.55);
    expect(d60.nutrition.length / 60).toBeLessThanOrEqual(0.85);
    expect(d60.habitLogs.length / (60 * 4)).toBeGreaterThanOrEqual(0.5);
    expect(d60.habitLogs.length / (60 * 4)).toBeLessThanOrEqual(0.7);
  });

  it('correlates concentration with prior-night sleep at about r = 0.4', () => {
    const sleepByDate = new Map(d90.sleep.map((s) => [s.date, s.durationMin]));
    const xs: number[] = [];
    const ys: number[] = [];
    for (const c of d90.checkins) {
      const dur = sleepByDate.get(c.date);
      if (dur !== undefined) {
        xs.push(dur);
        ys.push(c.concentration);
      }
    }
    expect(xs.length).toBeGreaterThanOrEqual(50);
    const r = pearson(xs, ys);
    expect(r).not.toBeNull();
    expect(r ?? 0).toBeGreaterThanOrEqual(0.2);
    expect(r ?? 1).toBeLessThanOrEqual(0.6);
  });

  it('keeps sleep in a realistic range with a ~7.2h center, and all ratings valid', () => {
    const durations = d90.sleep.map((s) => s.durationMin);
    for (const m of durations) {
      expect(m).toBeGreaterThanOrEqual(300);
      expect(m).toBeLessThanOrEqual(600);
    }
    const avg = mean(durations) ?? 0;
    expect(avg).toBeGreaterThanOrEqual(405);
    expect(avg).toBeLessThanOrEqual(465);
    const ratings: Rating[] = [
      ...d90.checkins.flatMap((c) => [c.mood, c.stress, c.energy, c.concentration, c.motivation]),
      ...d90.focus.flatMap((s) => [s.focusRating, s.difficulty]),
      ...d90.sleep.flatMap((s) => [s.quality, s.rested]),
      ...d90.movement.map((m) => m.effort),
    ];
    for (const r of ratings) expect(isRating(r)).toBe(true);
  });

  it('drifts bedtimes later on weekend wake-up days', () => {
    const eveningMin = (bedtime: string): number => {
      const d = parseISO(bedtime);
      const m = d.getHours() * 60 + d.getMinutes();
      return m < 720 ? m + 1440 : m; // continuous evening scale across midnight
    };
    const weekend: number[] = [];
    const weekday: number[] = [];
    for (const s of d90.sleep) {
      const dow = getDay(parseISO(s.date));
      (dow === 0 || dow === 6 ? weekend : weekday).push(eveningMin(s.bedtime));
    }
    expect(mean(weekend) ?? 0).toBeGreaterThan(mean(weekday) ?? 0);
  });

  it('varies learning methods across all six options', () => {
    expect(new Set(d90.focus.map((s) => s.method)).size).toBe(6);
  });
});
