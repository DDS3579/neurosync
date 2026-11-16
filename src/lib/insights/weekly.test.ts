import { describe, expect, it } from 'vitest';
import { format, parseISO, subDays, subMinutes } from 'date-fns';
import type {
  ActivityLog,
  DailyCheckin,
  FocusSession,
  GratitudeEntry,
  InsightInput,
  ISODate,
  JournalEntry,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  SleepLog,
  UserSettings,
} from '@/types/domain';
import { buildWeeklyReport } from './weekly';

const WEEK: ISODate = '2026-11-09'; // Monday; week = Nov 9–15, previous = Nov 2–8
const w = (offset: number): ISODate => format(subDays(parseISO(WEEK), -offset), 'yyyy-MM-dd'); // w(0)=Nov 9, w(6)=Nov 15, w(-1)=Nov 8

let seq = 0;
const base = () => ({ id: `t${++seq}`, createdAt: '2026-11-01T08:00:00', updatedAt: '2026-11-01T08:00:00' });
const settings = (over: Partial<UserSettings> = {}): UserSettings => ({
  ...base(), sleepTargetMin: 480, focusDefaultMin: 25, breakDefaultMin: 5, onboarded: true, schemaVersion: 1, ...over,
});
const sleepLog = (date: ISODate, durationMin: number, bedtime?: string): SleepLog => {
  const wake = parseISO(`${date}T07:00:00`);
  return {
    ...base(), date, durationMin,
    bedtime: bedtime ?? format(subMinutes(wake, durationMin), "yyyy-MM-dd'T'HH:mm:ss"),
    wakeTime: format(wake, "yyyy-MM-dd'T'HH:mm:ss"), quality: 3, rested: 3, interruptions: 0,
  };
};
const checkin = (date: ISODate, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  ...base(), date, mood: 3, stress: 3, energy: 3, concentration: 3, motivation: 3, ...over,
});
const focusLog = (date: ISODate, over: Partial<FocusSession> = {}): FocusSession => ({
  ...base(), date, startedAt: `${date}T09:00:00`, durationMin: 25, plannedMin: 25, subject: 'test',
  method: 'deep_reading', focusRating: 3, difficulty: 3, distractions: 0, ...over,
});
const moveLog = (date: ISODate, over: Partial<MovementLog> = {}): MovementLog => ({ ...base(), date, type: 'walk', durationMin: 30, effort: 3, ...over });
const nutriLog = (date: ISODate, over: Partial<NutritionLog> = {}): NutritionLog => ({ ...base(), date, regularMeals: true, fruitVeg: true, varied: true, waterGlasses: 6, ...over });
const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  settings: settings(), sleep: [], checkins: [], focus: [], movement: [], nutrition: [], habits: [], habitLogs: [], ...over,
});
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

describe('buildWeeklyReport — missing data', () => {
  it('returns null (never 0) for every average and spread on empty input', () => {
    const r = buildWeeklyReport(input(), WEEK);
    expect(r.weekStart).toBe(WEEK);
    expect(r.weekEnd).toBe('2026-11-15');
    expect(r.sleep.avgMin).toBeNull();
    expect(r.sleep.bedtimeSpreadMin).toBeNull();
    expect(r.focus.avgFocusRating).toBeNull();
    expect(r.wellbeing.avgMood).toBeNull();
    expect(r.wellbeing.avgStress).toBeNull();
    expect(r.wellbeing.avgEnergy).toBeNull();
    expect(r.wellbeing.avgConcentration).toBeNull();
    expect(r.nutrition.avgWater).toBeNull();
    expect(r.sleep.nightsLogged).toBe(0);
    expect(r.focus.totalMin).toBe(0);
    expect(r.focus.methodsUsed).toEqual([]);
    expect(r.vsPreviousWeek).toEqual({}); // nothing comparable, nothing invented
    expect(r.highlights.length).toBeGreaterThanOrEqual(1);
    expect(r.reflectionPrompts.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null bedtime spread for a single night', () => {
    const r = buildWeeklyReport(input({ sleep: [sleepLog(w(0), 480)] }), WEEK);
    expect(r.sleep.nightsLogged).toBe(1);
    expect(r.sleep.bedtimeSpreadMin).toBeNull();
  });
});

describe('buildWeeklyReport — computation', () => {
  it('computes sleep averages and below-target counts against the user target', () => {
    const r = buildWeeklyReport(input({ sleep: [sleepLog(w(0), 420), sleepLog(w(1), 480), sleepLog(w(2), 540)] }), WEEK);
    expect(r.sleep.avgMin).toBe(480);
    expect(r.sleep.nightsLogged).toBe(3);
    expect(r.sleep.nightsBelowTarget).toBe(1); // 420 < 480; 480 is not below
  });

  it('handles midnight wrap in bedtime spread (23:30 vs 00:30 ≈ 30 min)', () => {
    const r = buildWeeklyReport(input({
      sleep: [sleepLog(w(1), 480, `${w(0)}T23:30:00`), sleepLog(w(2), 420, `${w(2)}T00:30:00`)],
    }), WEEK);
    expect(r.sleep.bedtimeSpreadMin).toBeCloseTo(30, 0);
  });

  it('includes window edges and excludes the day after weekEnd', () => {
    const r = buildWeeklyReport(input({
      sleep: [sleepLog(w(-1), 300), sleepLog(w(0), 420), sleepLog(w(6), 480), sleepLog(w(7), 500)],
    }), WEEK);
    expect(r.sleep.nightsLogged).toBe(2);
    expect(r.sleep.avgMin).toBe(450);
    expect(r.vsPreviousWeek.sleepAvgMin).toEqual({ delta: 150, direction: 'up' }); // prev week: 300
  });

  it('dedupes and sorts methods, counts distinct movement days, and uses last nutrition log per day', () => {
    const r = buildWeeklyReport(input({
      focus: [focusLog(w(0), { method: 'spaced_repetition' }), focusLog(w(1), { method: 'active_recall' }), focusLog(w(2), { method: 'active_recall' })],
      movement: [moveLog(w(0)), moveLog(w(0), { durationMin: 20 }), moveLog(w(1))],
      nutrition: [nutriLog(w(0), { regularMeals: false, waterGlasses: 4 }), nutriLog(w(0), { regularMeals: true, waterGlasses: 8 }), nutriLog(w(1), { regularMeals: false, waterGlasses: 6 })],
    }), WEEK);
    expect(r.focus.methodsUsed).toEqual(['active_recall', 'spaced_repetition']);
    expect(r.focus.methodBreakdown).toEqual([
      { method: 'active_recall', sessions: 2, totalMin: 50 },
      { method: 'spaced_repetition', sessions: 1, totalMin: 25 },
    ]);
    expect(r.focus.retrievalSessions).toBe(2);
    expect(r.focus.reviewedPriorSessions).toBe(1);
    expect(r.movement.daysActive).toBe(2);
    expect(r.movement.totalMin).toBe(80);
    expect(r.nutrition.daysLogged).toBe(2);
    expect(r.nutrition.regularMealDays).toBe(1);
    expect(r.nutrition.avgWater).toBe(7);
    expect(r.daily).toHaveLength(7);
  });

  it('aggregates v0.2 mind, activities, brainActivity, and week-over-week deltas', () => {
    const mindfulness: MindfulnessSession[] = [
      { ...base(), date: w(0), type: 'box_breathing', durationMin: 5 },
      { ...base(), date: w(2), type: 'meditation', durationMin: 15 },
      { ...base(), date: w(-3), type: 'box_breathing', durationMin: 5 },
    ];
    const activities: ActivityLog[] = [
      { ...base(), date: w(1), type: 'social', durationMin: 45, enjoyment: 5 },
      { ...base(), date: w(3), type: 'novelty', durationMin: 30, enjoyment: 4 },
      { ...base(), date: w(-4), type: 'music', durationMin: 20, enjoyment: 4 },
    ];
    const journal: JournalEntry[] = [
      { ...base(), date: w(0), text: 'Quiet morning.' },
      { ...base(), date: w(4), text: 'Good afternoon walk.' },
    ];
    const gratitude: GratitudeEntry[] = [
      { ...base(), date: w(1), items: ['Warm coffee', 'Helpful chat'] },
    ];

    const r = buildWeeklyReport(
      input({ mindfulness, activities, journal, gratitude }),
      WEEK,
    );

    expect(r.mind).toEqual({
      mindfulnessSessions: 2,
      mindfulnessMin: 20,
      journalEntries: 2,
      gratitudeDays: 1,
    });
    expect(r.activities).toEqual({
      totalLogs: 2,
      totalMin: 75,
      distinctTypes: 2,
      typesUsed: ['novelty', 'social'],
      byType: [
        { type: 'novelty', count: 1, totalMin: 30 },
        { type: 'social', count: 1, totalMin: 45 },
      ],
    });
    expect(r.vsPreviousWeek.mindfulnessMin).toEqual({ delta: 15, direction: 'up' });
    expect(r.vsPreviousWeek.activitiesMin).toEqual({ delta: 55, direction: 'up' });
    expect(r.vsPreviousWeek.activitiesDistinctTypes).toEqual({ delta: 1, direction: 'up' });
    expect(r.brainActivity.regions.prefrontal).toBeGreaterThan(0);
    expect(r.brainActivity.topRegions.length).toBeGreaterThan(0);
    expect(r.daily[0]?.mindAndActivityMin).toBe(5);
    expect(r.daily[1]?.mindAndActivityMin).toBe(45);
  });
});

describe('buildWeeklyReport — vsPreviousWeek tolerances', () => {
  it('marks clear changes up, small changes flat, and omits metrics without two-sided data', () => {
    const current = [0, 1, 2, 3, 4].map((k) => checkin(w(k), { mood: 4, concentration: k === 4 ? 4 : 3 }));
    const previous = [0, 1, 2, 3, 4].map((k) => checkin(w(k - 7)));
    const r = buildWeeklyReport(input({ checkins: [...current, ...previous] }), WEEK);
    expect(r.vsPreviousWeek.avgMood).toEqual({ delta: 1, direction: 'up' });
    expect(r.vsPreviousWeek.avgConcentration).toEqual({ delta: 0.2, direction: 'flat' }); // 3.2 vs 3, tolerance 0.3
    expect(r.vsPreviousWeek.avgStress).toEqual({ delta: 0, direction: 'flat' });
    expect(r.vsPreviousWeek.sleepAvgMin).toBeUndefined(); // no sleep either week
  });

  it('treats focus totals within 30 min as flat and larger gaps as up', () => {
    const mk = (cur: number, prev: number) => buildWeeklyReport(input({
      focus: [focusLog(w(0), { durationMin: cur }), focusLog(w(-7), { durationMin: prev })],
    }), WEEK);
    expect(mk(50, 40).vsPreviousWeek.focusTotalMin).toEqual({ delta: 10, direction: 'flat' });
    expect(mk(60, 20).vsPreviousWeek.focusTotalMin).toEqual({ delta: 40, direction: 'up' });
  });
});

describe('buildWeeklyReport — copy safety & purity', () => {
  const BANNED = [/\bscore/i, /\bbrain health\b/i, /\bgrew\b/i, /\bstrengthen/i, /\bfail/i, /\bsham(e|ing)\b/i, /\bguilt/i, /\blazy\b/i, /\bbad\b/i, /\bshould\b/i, /\bboost/i, /\bcure[ds]?\b/i];

  it('keeps highlights and prompts warm and factual on populated and empty weeks', () => {
    const populated = buildWeeklyReport(input({
      sleep: [sleepLog(w(0), 480), sleepLog(w(1), 500)],
      focus: [focusLog(w(0), { focusRating: 5 }), focusLog(w(1), { focusRating: 2 })],
      movement: [moveLog(w(0)), moveLog(w(1)), moveLog(w(2)), moveLog(w(3))],
      checkins: [0, 1, 2, 3, 4].map((k) => checkin(w(k))),
    }), WEEK);
    const empty = buildWeeklyReport(input(), WEEK);
    for (const text of [...populated.highlights, ...populated.reflectionPrompts, ...empty.highlights, ...empty.reflectionPrompts]) {
      for (const pattern of BANNED) expect(text).not.toMatch(pattern);
    }
    expect(populated.highlights.join(' ')).toMatch(/\d/); // factual numbers present
    expect(populated.reflectionPrompts).toContain('What made your best-focus day different?');
    expect(populated.reflectionPrompts.every((p) => p.endsWith('?'))).toBe(true);
  });

  it('is deterministic and never mutates input (deep-frozen works)', () => {
    const data = input({ sleep: [sleepLog(w(0), 450), sleepLog(w(1), 510)], checkins: [checkin(w(0))] });
    const a = buildWeeklyReport(data, WEEK);
    expect(buildWeeklyReport(data, WEEK)).toEqual(a);
    expect(buildWeeklyReport(deepFreeze(data), WEEK)).toEqual(a);
  });
});
