import { describe, expect, it } from 'vitest';
import { format, parseISO, subDays, subMinutes } from 'date-fns';
import type {
  ActivityLog,
  Block,
  DailyCheckin,
  DayPlan,
  DayPlanMeta,
  FocusSession,
  Insight,
  InsightInput,
  ISODate,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  Rating,
  SleepLog,
  Task,
  UserSettings,
} from '@/types/domain';
import { RULES } from './rules';
import {
  buildConfidence,
  classifyDataConfidence,
  computeInsights,
  computeSnoozeUntil,
  generateDemoData,
  isInsightSuppressed,
  partitionInsightsByFeedback,
  selectOverviewInsights,
} from './index';

// Domain imports above are type-only, so these tests run under Vitest with no path-alias config.

const TODAY: ISODate = '2026-11-16';
/** d(0) = today, d(6) = start of the inclusive 7-day window, d(-1) = tomorrow. */
const d = (offset: number): ISODate => format(subDays(parseISO(TODAY), offset), 'yyyy-MM-dd');

// ---------- fixture factories ----------

let seq = 0;
const base = () => ({
  id: `t${++seq}`,
  createdAt: '2026-11-01T08:00:00',
  updatedAt: '2026-11-01T08:00:00',
});

const makeSettings = (over: Partial<UserSettings> = {}): UserSettings => ({
  ...base(),
  sleepTargetMin: 480,
  focusDefaultMin: 25,
  breakDefaultMin: 5,
  onboarded: true,
  schemaVersion: 1,
  ...over,
});

const makeSleep = (date: ISODate, durationMin: number, over: Partial<SleepLog> = {}): SleepLog => {
  const wake = parseISO(`${date}T07:00:00`);
  const bed = subMinutes(wake, durationMin);
  return {
    ...base(),
    date,
    bedtime: format(bed, "yyyy-MM-dd'T'HH:mm:ss"),
    wakeTime: format(wake, "yyyy-MM-dd'T'HH:mm:ss"),
    durationMin,
    quality: 3,
    rested: 3,
    interruptions: 0,
    ...over,
  };
};

const makeCheckin = (date: ISODate, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  ...base(),
  date,
  mood: 3,
  stress: 3,
  energy: 3,
  concentration: 3,
  motivation: 3,
  ...over,
});

const makeFocus = (date: ISODate, over: Partial<FocusSession> = {}): FocusSession => ({
  ...base(),
  date,
  startedAt: `${date}T09:00:00`,
  durationMin: 25,
  plannedMin: 25,
  subject: 'test',
  method: 'deep_reading',
  focusRating: 3,
  difficulty: 3,
  distractions: 0,
  ...over,
});

const makeMovement = (date: ISODate, over: Partial<MovementLog> = {}): MovementLog => ({
  ...base(),
  date,
  type: 'walk',
  durationMin: 30,
  effort: 3,
  ...over,
});

const makeNutrition = (date: ISODate, over: Partial<NutritionLog> = {}): NutritionLog => ({
  ...base(),
  date,
  regularMeals: true,
  fruitVeg: true,
  varied: true,
  waterGlasses: 6,
  ...over,
});

const makeActivity = (
  date: ISODate,
  type: ActivityLog['type'],
  durationMin = 30,
): ActivityLog => ({
  ...base(),
  date,
  type,
  durationMin,
  enjoyment: 4,
});

const makeMindfulness = (date: ISODate, durationMin = 5): MindfulnessSession => ({
  ...base(),
  date,
  type: 'box_breathing',
  durationMin,
});

const emptyInput = (over: Partial<InsightInput> = {}): InsightInput => ({
  settings: makeSettings(),
  sleep: [],
  checkins: [],
  focus: [],
  movement: [],
  nutrition: [],
  habits: [],
  habitLogs: [],
  ...over,
});

function runRule(id: string, input: InsightInput, today: ISODate = TODAY): Insight | null {
  const rule = RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Unknown rule: ${id}`);
  return rule.run(input, today);
}

/** Fixture that fires ALL nine rules (verified numerically). */
function fullInput(): InsightInput {
  const durations = [560, 550, 540, 530, 520, 510, 500, 470, 465, 460, 450, 440, 430, 420]; // d(13)..d(0)
  const concentrations: Rating[] = [5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 1, 1, 1];
  const sleep = durations.map((min, i) => {
    const k = 13 - i;
    // Last 7 nights: bedtimes alternate 21:00 / 02:00 → circular SD ≈ 154 min.
    const over: Partial<SleepLog> =
      k <= 6 ? { bedtime: k % 2 === 0 ? `${d(k + 1)}T21:00:00` : `${d(k)}T02:00:00` } : {};
    return makeSleep(d(k), min, over);
  });
  const checkins = concentrations.map((c, i) => makeCheckin(d(13 - i), { concentration: c }));
  const focus = [
    makeFocus(d(6), { durationMin: 100, plannedMin: 100, distractions: 0, method: 'active_recall' }),
    makeFocus(d(4), { durationMin: 100, plannedMin: 100, distractions: 2, method: 'spaced_repetition' }),
    makeFocus(d(2), { durationMin: 100, plannedMin: 100, distractions: 4, method: 'problem_solving' }),
  ];
  const movement = [
    makeMovement(d(6), { type: 'walk' }),
    makeMovement(d(5), { type: 'run' }),
    makeMovement(d(4), { type: 'cycle' }),
    makeMovement(d(3), { type: 'stretch' }),
  ];
  const nutrition = [6, 5, 4, 3, 2, 1, 0].map((k) =>
    makeNutrition(d(k), { regularMeals: k % 2 === 0 }),
  );
  return emptyInput({ sleep, checkins, focus, movement, nutrition });
}

/** Negative sleep↔focus correlation (r ≈ −0.98) to exercise the neutral inverse wording. */
function negativePairingInput(): InsightInput {
  const conc: Rating[] = [5, 5, 4, 4, 3, 3, 2, 2];
  return emptyInput({
    sleep: conc.map((_, i) => makeSleep(d(7 - i), 360 + 30 * i)),
    checkins: conc.map((c, i) => makeCheckin(d(7 - i), { concentration: c })),
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

// ---------- sleep_below_target ----------

describe('sleep_below_target', () => {
  it('fires at the exact boundary: 3 of 7 nights below target', () => {
    const durations = [470, 470, 470, 480, 480, 480, 480];
    const input = emptyInput({ sleep: durations.map((m, i) => makeSleep(d(6 - i), m)) });
    const insight = runRule('sleep_below_target', input);
    expect(insight).not.toBeNull();
    expect(insight?.id).toBe('sleep_below_target');
    expect(insight?.kind).toBe('observation');
    expect(insight?.regions).toContain('hippocampus');
    expect(insight?.evidence.length).toBeGreaterThan(0);
  });
  it('returns null with only 2 nights below target', () => {
    const durations = [470, 470, 480, 480, 480, 480, 480];
    const input = emptyInput({ sleep: durations.map((m, i) => makeSleep(d(6 - i), m)) });
    expect(runRule('sleep_below_target', input)).toBeNull();
  });
  it('returns null with fewer than 3 logged nights even if all are short', () => {
    const input = emptyInput({ sleep: [makeSleep(d(1), 300), makeSleep(d(0), 300)] });
    expect(runRule('sleep_below_target', input)).toBeNull();
  });
  it('treats exactly-at-target as not below', () => {
    const input = emptyInput({ sleep: [0, 1, 2, 3].map((k) => makeSleep(d(k), 480)) });
    expect(runRule('sleep_below_target', input)).toBeNull();
  });
  it('ignores nights outside the 7-day window and future-dated logs', () => {
    const input = emptyInput({
      sleep: [
        makeSleep(d(10), 300), makeSleep(d(9), 300), makeSleep(d(8), 300),
        makeSleep(d(2), 480), makeSleep(d(1), 480), makeSleep(d(0), 480),
        makeSleep(d(-1), 100),
      ],
    });
    expect(runRule('sleep_below_target', input)).toBeNull();
  });
  it('compares against the user-set target, not a fixed number', () => {
    const sleep = [400, 410, 415].map((m, i) => makeSleep(d(2 - i), m));
    expect(runRule('sleep_below_target', emptyInput({ sleep }))).not.toBeNull();
    const custom = emptyInput({ sleep, settings: makeSettings({ sleepTargetMin: 390 }) });
    expect(runRule('sleep_below_target', custom)).toBeNull();
  });
});

// ---------- bedtime_irregular ----------

describe('bedtime_irregular', () => {
  it('fires when 5+ nights alternate 21:00 / 02:00 (spread ≈ 152 min)', () => {
    const sleep = [6, 5, 4, 3, 2, 1, 0].map((k) =>
      makeSleep(d(k), 480, { bedtime: k % 2 === 0 ? `${d(k + 1)}T21:00:00` : `${d(k)}T02:00:00` }),
    );
    expect(runRule('bedtime_irregular', emptyInput({ sleep }))).not.toBeNull();
  });
  it('returns null with only 4 nights, however scattered', () => {
    const sleep = [3, 2, 1, 0].map((k) =>
      makeSleep(d(k), 480, { bedtime: k % 2 === 0 ? `${d(k + 1)}T21:00:00` : `${d(k)}T02:00:00` }),
    );
    expect(runRule('bedtime_irregular', emptyInput({ sleep }))).toBeNull();
  });
  it('does not false-positive on tight bedtimes that straddle midnight', () => {
    const bedtimes = [
      `${d(5)}T23:30:00`, `${d(3)}T00:30:00`, `${d(3)}T23:45:00`,
      `${d(1)}T00:15:00`, `${d(1)}T23:50:00`,
    ];
    const sleep = [4, 3, 2, 1, 0].map((k, i) => makeSleep(d(k), 480, { bedtime: bedtimes[i] }));
    expect(runRule('bedtime_irregular', emptyInput({ sleep }))).toBeNull();
  });
});

// ---------- sleep_focus_pairing ----------

describe('sleep_focus_pairing', () => {
  it('fires with ≥7 strongly correlated pairs (check-in concentration)', () => {
    const conc: Rating[] = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    const input = emptyInput({
      sleep: conc.map((_, i) => makeSleep(d(9 - i), 360 + 24 * i)),
      checkins: conc.map((c, i) => makeCheckin(d(9 - i), { concentration: c })),
    });
    const insight = runRule('sleep_focus_pairing', input);
    expect(insight).not.toBeNull();
    expect(insight?.regions).toEqual(expect.arrayContaining(['hippocampus', 'prefrontal']));
    expect(insight?.evidence.join(' ')).toMatch(/Pearson r = 0\.98/);
  });
  it('returns null with exactly 6 pairs (boundary: 7 required)', () => {
    const conc: Rating[] = [1, 2, 2, 3, 4, 5];
    const input = emptyInput({
      sleep: conc.map((_, i) => makeSleep(d(5 - i), 360 + 30 * i)),
      checkins: conc.map((c, i) => makeCheckin(d(5 - i), { concentration: c })),
    });
    expect(runRule('sleep_focus_pairing', input)).toBeNull();
  });
  it('fires at exactly 7 pairs, falling back to mean session focus without check-ins', () => {
    const ratings: Rating[] = [1, 2, 2, 3, 3, 4, 5];
    const input = emptyInput({
      sleep: ratings.map((_, i) => makeSleep(d(6 - i), 360 + 30 * i)),
      focus: ratings.flatMap((r, i) => [
        makeFocus(d(6 - i), { focusRating: r }),
        makeFocus(d(6 - i), { focusRating: r, startedAt: `${d(6 - i)}T15:00:00` }),
      ]),
    });
    expect(runRule('sleep_focus_pairing', input)).not.toBeNull();
  });
  it('returns null when concentration has zero variance', () => {
    const input = emptyInput({
      sleep: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => makeSleep(d(k), 360 + 30 * k)),
      checkins: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => makeCheckin(d(k))),
    });
    expect(runRule('sleep_focus_pairing', input)).toBeNull();
  });
  it('returns null when |r| < 0.3 (weak pattern, r ≈ 0.22)', () => {
    const conc: Rating[] = [1, 5, 1, 5, 1, 5, 1, 5];
    const input = emptyInput({
      sleep: conc.map((_, i) => makeSleep(d(7 - i), 360 + 30 * i)),
      checkins: conc.map((c, i) => makeCheckin(d(7 - i), { concentration: c })),
    });
    expect(runRule('sleep_focus_pairing', input)).toBeNull();
  });
  it('states a negative correlation neutrally', () => {
    const insight = runRule('sleep_focus_pairing', negativePairingInput());
    expect(insight).not.toBeNull();
    expect(insight?.body).toContain('coincide with lower focus ratings');
    expect(insight?.body).toContain('curiosity rather than concern');
  });
});

// ---------- low_focus_streak ----------

describe('low_focus_streak', () => {
  it('fires at the boundary: exactly 3 of the last 5 logged days rated ≤2', () => {
    const conc: Rating[] = [2, 2, 2, 3, 3];
    const input = emptyInput({ checkins: conc.map((c, i) => makeCheckin(d(4 - i), { concentration: c })) });
    const insight = runRule('low_focus_streak', input);
    expect(insight?.kind).toBe('reflection');
    expect(insight?.regions).toEqual(expect.arrayContaining(['prefrontal', 'parietal']));
  });
  it('returns null with only 2 low days (rating 3 does not count)', () => {
    const conc: Rating[] = [3, 3, 3, 2, 2];
    const input = emptyInput({ checkins: conc.map((c, i) => makeCheckin(d(4 - i), { concentration: c })) });
    expect(runRule('low_focus_streak', input)).toBeNull();
  });
  it('returns null with only 4 logged days, even if all are low', () => {
    const input = emptyInput({ checkins: [0, 1, 2, 3].map((k) => makeCheckin(d(k), { concentration: 1 })) });
    expect(runRule('low_focus_streak', input)).toBeNull();
  });
  it('uses session focus ratings when no check-ins exist', () => {
    const ratings: Rating[] = [1, 2, 1, 4, 5];
    const input = emptyInput({ focus: ratings.map((r, i) => makeFocus(d(4 - i), { focusRating: r })) });
    expect(runRule('low_focus_streak', input)).not.toBeNull();
  });
});

// ---------- long_sessions_no_breaks ----------

describe('long_sessions_no_breaks', () => {
  const long = (k: number, distractions: number, durationMin = 100) =>
    makeFocus(d(k), { durationMin, plannedMin: durationMin, distractions });

  it('fires for 3 long sessions with rising distractions; short sessions are ignored', () => {
    const input = emptyInput({
      focus: [long(5, 0), long(3, 2), long(1, 4), makeFocus(d(2), { distractions: 9 })],
    });
    expect(runRule('long_sessions_no_breaks', input)).not.toBeNull();
  });
  it('returns null when distractions are flat or falling', () => {
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(5, 2), long(3, 2), long(1, 2)] }))).toBeNull();
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(5, 4), long(3, 2), long(1, 0)] }))).toBeNull();
  });
  it('requires strictly over 90 minutes: 90 fails, 91 fires', () => {
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(5, 0, 90), long(3, 1, 90), long(1, 2, 90)] }))).toBeNull();
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(5, 0, 91), long(3, 1, 91), long(1, 2, 91)] }))).not.toBeNull();
  });
  it('returns null with only 2 long sessions in the window (older ones excluded)', () => {
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(5, 0), long(3, 2)] }))).toBeNull();
    expect(runRule('long_sessions_no_breaks', emptyInput({ focus: [long(8, 0), long(5, 2), long(3, 4)] }))).toBeNull();
  });
});

// ---------- milestones & meal_regularity ----------

describe('movement_consistency', () => {
  it('fires at exactly 4 distinct active days', () => {
    const input = emptyInput({ movement: [6, 5, 4, 3].map((k) => makeMovement(d(k))) });
    expect(runRule('movement_consistency', input)?.kind).toBe('milestone');
  });
  it('counts distinct days, not entries (4 logs on 3 days → null)', () => {
    const input = emptyInput({ movement: [6, 6, 5, 4].map((k) => makeMovement(d(k))) });
    expect(runRule('movement_consistency', input)).toBeNull();
  });
  it('returns null with 3 active days', () => {
    const input = emptyInput({ movement: [6, 5, 4].map((k) => makeMovement(d(k))) });
    expect(runRule('movement_consistency', input)).toBeNull();
  });
});

describe('learning_variety', () => {
  it('fires with 3 distinct methods inside 14 days', () => {
    const input = emptyInput({
      focus: [
        makeFocus(d(10), { method: 'active_recall' }),
        makeFocus(d(5), { method: 'spaced_repetition' }),
        makeFocus(d(1), { method: 'problem_solving' }),
      ],
    });
    expect(runRule('learning_variety', input)?.kind).toBe('milestone');
  });
  it('returns null with only 2 methods', () => {
    const input = emptyInput({
      focus: [
        makeFocus(d(10), { method: 'active_recall' }),
        makeFocus(d(5), { method: 'spaced_repetition' }),
        makeFocus(d(1), { method: 'active_recall' }),
      ],
    });
    expect(runRule('learning_variety', input)).toBeNull();
  });
  it('excludes a third method logged 15 days ago (window boundary)', () => {
    const input = emptyInput({
      focus: [
        makeFocus(d(14), { method: 'teaching' }),
        makeFocus(d(5), { method: 'spaced_repetition' }),
        makeFocus(d(1), { method: 'active_recall' }),
      ],
    });
    expect(runRule('learning_variety', input)).toBeNull();
  });
});

describe('meal_regularity', () => {
  it('fires at exactly 3 irregular days of 7 logged', () => {
    const input = emptyInput({
      nutrition: [6, 5, 4, 3, 2, 1, 0].map((k) => makeNutrition(d(k), { regularMeals: k > 3 })),
    });
    expect(runRule('meal_regularity', input)?.kind).toBe('reflection');
  });
  it('returns null with only 2 irregular days', () => {
    const input = emptyInput({
      nutrition: [6, 5, 4, 3, 2, 1, 0].map((k) => makeNutrition(d(k), { regularMeals: k !== 6 && k !== 4 })),
    });
    expect(runRule('meal_regularity', input)).toBeNull();
  });
  it('returns null with fewer than 3 logged days, even if all irregular', () => {
    const input = emptyInput({
      nutrition: [1, 0].map((k) => makeNutrition(d(k), { regularMeals: false })),
    });
    expect(runRule('meal_regularity', input)).toBeNull();
  });
});

describe('checkin_consistency', () => {
  it('fires at exactly 5 check-in days', () => {
    const input = emptyInput({ checkins: [6, 5, 4, 3, 2].map((k) => makeCheckin(d(k))) });
    expect(runRule('checkin_consistency', input)?.kind).toBe('milestone');
  });
  it('returns null with 4 check-in days', () => {
    const input = emptyInput({ checkins: [6, 5, 4, 3].map((k) => makeCheckin(d(k))) });
    expect(runRule('checkin_consistency', input)).toBeNull();
  });
});

describe('activity_variety', () => {
  it('fires as a milestone when 3+ distinct activity types are logged in the last 7 days', () => {
    const input = emptyInput({
      activities: [
        makeActivity(d(5), 'social', 45),
        makeActivity(d(3), 'creative', 30),
        makeActivity(d(1), 'novelty', 20),
      ],
    });
    const insight = runRule('activity_variety', input);
    expect(insight?.kind).toBe('milestone');
    expect(insight?.title).toContain('3 kinds of activities');
  });

  it('returns null when fewer than 3 distinct types are logged', () => {
    const input = emptyInput({
      activities: [
        makeActivity(d(5), 'social', 30),
        makeActivity(d(3), 'social', 40),
        makeActivity(d(1), 'music', 25),
      ],
    });
    expect(runRule('activity_variety', input)).toBeNull();
  });
});

describe('study_without_recovery', () => {
  it('fires as a warm reflection when 4+ study sessions (>=120m) have no social/recovery logs', () => {
    const input = emptyInput({
      focus: [4, 3, 2, 1].map((k) => makeFocus(d(k), { durationMin: 40 })),
    });
    const insight = runRule('study_without_recovery', input);
    expect(insight?.kind).toBe('reflection');
  });

  it('does not fire when social activity or mindfulness is logged', () => {
    const withSocial = emptyInput({
      focus: [4, 3, 2, 1].map((k) => makeFocus(d(k), { durationMin: 40 })),
      activities: [makeActivity(d(1), 'social', 30)],
    });
    expect(runRule('study_without_recovery', withSocial)).toBeNull();

    const withMindful = emptyInput({
      focus: [4, 3, 2, 1].map((k) => makeFocus(d(k), { durationMin: 40 })),
      mindfulness: [makeMindfulness(d(1), 5)],
    });
    expect(runRule('study_without_recovery', withMindful)).toBeNull();
  });
});

describe('reading_without_retrieval', () => {
  it('fires when 3+ deep_reading sessions occur over 14 days with no retrieval practice', () => {
    const input = emptyInput({
      focus: [10, 6, 2].map((k) =>
        makeFocus(d(k), { method: 'deep_reading', durationMin: 40, practicedRetrieval: false }),
      ),
    });
    const insight = runRule('reading_without_retrieval', input);
    expect(insight?.kind).toBe('reflection');
    expect(insight?.education).toMatch(/retrieval practice/i);
  });

  it('does not fire when active_recall or practicedRetrieval is logged', () => {
    const withToggle = emptyInput({
      focus: [
        makeFocus(d(10), { method: 'deep_reading', practicedRetrieval: false }),
        makeFocus(d(6), { method: 'deep_reading', practicedRetrieval: false }),
        makeFocus(d(2), { method: 'deep_reading', practicedRetrieval: true }),
      ],
    });
    expect(runRule('reading_without_retrieval', withToggle)).toBeNull();

    const withMethod = emptyInput({
      focus: [
        makeFocus(d(10), { method: 'deep_reading' }),
        makeFocus(d(6), { method: 'deep_reading' }),
        makeFocus(d(4), { method: 'deep_reading' }),
        makeFocus(d(2), { method: 'active_recall' }),
      ],
    });
    expect(runRule('reading_without_retrieval', withMethod)).toBeNull();
  });
});

// ---------- v0.2 insight rules ----------

describe('session_length_vs_focus', () => {
  it('fires at 6 sessions when duration and self-rated focus correlate (positive and negative)', () => {
    const pos = emptyInput({
      focus: [20, 25, 35, 50, 65, 80].map((dur, i) =>
        makeFocus(d(10 - i), {
          durationMin: dur,
          focusRating: ([1, 2, 3, 4, 5, 5][i] as Rating),
        }),
      ),
    });
    const posInsight = runRule('session_length_vs_focus', pos);
    expect(posInsight?.kind).toBe('observation');
    expect(posInsight?.pillar).toBe('focus');
    expect(posInsight?.confidence?.sampleSize).toBe(6);

    const neg = emptyInput({
      focus: [20, 25, 35, 50, 65, 80].map((dur, i) =>
        makeFocus(d(10 - i), {
          durationMin: dur,
          focusRating: ([5, 5, 4, 3, 2, 1][i] as Rating),
        }),
      ),
    });
    const negInsight = runRule('session_length_vs_focus', neg);
    expect(negInsight?.title).toMatch(/shorter/i);
  });

  it('respects minimum sample (5 sessions -> null) and |r| >= 0.3 threshold', () => {
    const five = emptyInput({
      focus: [20, 30, 40, 50, 60].map((dur, i) =>
        makeFocus(d(5 - i), { durationMin: dur, focusRating: (i + 1) as Rating }),
      ),
    });
    expect(runRule('session_length_vs_focus', five)).toBeNull();

    const flat = emptyInput({
      focus: [20, 30, 40, 50, 60, 70].map((dur, i) =>
        makeFocus(d(6 - i), { durationMin: dur, focusRating: 3 }),
      ),
    });
    expect(runRule('session_length_vs_focus', flat)).toBeNull();
  });
});

describe('weekday_vs_weekend_pattern', () => {
  it('fires when 4+ weekdays and 2+ weekend nights differ in duration or bedtime', () => {
    // TODAY = Mon 2026-11-16: d(1)=Sun, d(2)=Sat, d(3)=Fri, d(4)=Thu, d(5)=Wed, d(6)=Tue
    const input = emptyInput({
      sleep: [
        makeSleep(d(6), 420),
        makeSleep(d(5), 420),
        makeSleep(d(4), 420),
        makeSleep(d(3), 420),
        makeSleep(d(2), 540, { wakeTime: `${d(2)}T09:00:00`, bedtime: `${d(2)}T00:00:00` }),
        makeSleep(d(1), 540, { wakeTime: `${d(1)}T09:00:00`, bedtime: `${d(1)}T00:00:00` }),
      ],
    });
    const insight = runRule('weekday_vs_weekend_pattern', input);
    expect(insight?.pillar).toBe('sleep');
    expect(insight?.kind).toBe('observation');
    expect(insight?.confidence?.sampleSize).toBe(6);
  });

  it('returns null with only 1 weekend night or negligible weekday/weekend difference', () => {
    const oneWeekend = emptyInput({
      sleep: [
        makeSleep(d(6), 420),
        makeSleep(d(5), 420),
        makeSleep(d(4), 420),
        makeSleep(d(3), 420),
        makeSleep(d(2), 540),
      ],
    });
    expect(runRule('weekday_vs_weekend_pattern', oneWeekend)).toBeNull();

    const similar = emptyInput({
      sleep: [6, 5, 4, 3, 2, 1].map((k) => makeSleep(d(k), 460)),
    });
    expect(runRule('weekday_vs_weekend_pattern', similar)).toBeNull();
  });
});

describe('outdoor_time_mood_energy', () => {
  it('fires at 6 check-in days with outdoorMin correlating with mood/energy', () => {
    const input = emptyInput({
      checkins: [5, 10, 20, 40, 55, 70].map((outdoorMin, i) =>
        makeCheckin(d(6 - i), {
          outdoorMin,
          mood: ([2, 2, 3, 4, 4, 5][i] as Rating),
          energy: ([2, 3, 3, 4, 5, 5][i] as Rating),
        }),
      ),
    });
    const insight = runRule('outdoor_time_mood_energy', input);
    expect(insight?.pillar).toBe('wellbeing');
    expect(insight?.kind).toBe('observation');
    expect(insight?.confidence?.summary).toContain('6 days of paired data');
  });

  it('returns null with 5 days or when outdoorMin is missing', () => {
    const five = emptyInput({
      checkins: [5, 15, 30, 45, 60].map((outdoorMin, i) =>
        makeCheckin(d(5 - i), { outdoorMin, mood: (i + 1) as Rating }),
      ),
    });
    expect(runRule('outdoor_time_mood_energy', five)).toBeNull();

    const noOutdoor = emptyInput({
      checkins: [6, 5, 4, 3, 2, 1].map((k, i) =>
        makeCheckin(d(k), { mood: (Math.min(5, i + 1)) as Rating }),
      ),
    });
    expect(runRule('outdoor_time_mood_energy', noOutdoor)).toBeNull();
  });
});

describe('mindfulness_vs_stress', () => {
  it('fires when 3+ mindfulness days and 3+ non-mindfulness days differ by >= 0.4 stress', () => {
    const lowerStress = emptyInput({
      checkins: [
        makeCheckin(d(10), { stress: 2 }),
        makeCheckin(d(9), { stress: 2 }),
        makeCheckin(d(8), { stress: 1 }),
        makeCheckin(d(5), { stress: 4 }),
        makeCheckin(d(4), { stress: 4 }),
        makeCheckin(d(3), { stress: 5 }),
      ],
      mindfulness: [10, 9, 8].map((k) => makeMindfulness(d(k), 5)),
    });
    const insight = runRule('mindfulness_vs_stress', lowerStress);
    expect(insight?.pillar).toBe('wellbeing');
    expect(insight?.regions).toContain('amygdala');
    expect(insight?.confidence?.sampleSize).toBe(6);

    const higherStress = emptyInput({
      checkins: [
        makeCheckin(d(10), { stress: 4 }),
        makeCheckin(d(9), { stress: 5 }),
        makeCheckin(d(8), { stress: 4 }),
        makeCheckin(d(5), { stress: 2 }),
        makeCheckin(d(4), { stress: 2 }),
        makeCheckin(d(3), { stress: 2 }),
      ],
      mindfulness: [10, 9, 8].map((k) => makeMindfulness(d(k), 5)),
    });
    expect(runRule('mindfulness_vs_stress', higherStress)?.title).toMatch(/fuller-stress/i);
  });

  it('returns null with < 3 days in either group or small difference', () => {
    const twoMindful = emptyInput({
      checkins: [6, 5, 4, 3, 2, 1].map((k) =>
        makeCheckin(d(k), { stress: k >= 5 ? 1 : 5 }),
      ),
      mindfulness: [6, 5].map((k) => makeMindfulness(d(k), 5)),
    });
    expect(runRule('mindfulness_vs_stress', twoMindful)).toBeNull();

    const tinyDiff = emptyInput({
      checkins: [6, 5, 4, 3, 2, 1].map((k) => makeCheckin(d(k), { stress: 3 })),
      mindfulness: [6, 5, 4].map((k) => makeMindfulness(d(k), 5)),
    });
    expect(runRule('mindfulness_vs_stress', tinyDiff)).toBeNull();
  });
});

describe('activity_variety_mood', () => {
  it('fires when 6+ check-ins and 4+ multi-type activities correlate on trailing variety vs mood', () => {
    const input = emptyInput({
      checkins: [
        makeCheckin(d(15), { mood: 2 }),
        makeCheckin(d(14), { mood: 2 }),
        makeCheckin(d(13), { mood: 2 }),
        makeCheckin(d(4), { mood: 4 }),
        makeCheckin(d(2), { mood: 5 }),
        makeCheckin(d(0), { mood: 5 }),
      ],
      activities: [
        makeActivity(d(4), 'social', 30),
        makeActivity(d(3), 'creative', 25),
        makeActivity(d(2), 'music', 25),
        makeActivity(d(0), 'novelty', 20),
      ],
    });
    const insight = runRule('activity_variety_mood', input);
    expect(insight?.pillar).toBe('wellbeing');
    expect(insight?.kind).toBe('observation');
    expect(insight?.confidence?.sampleSize).toBe(6);
  });

  it('returns null if fewer than 2 distinct activity types or fewer than 4 logs', () => {
    const singleType = emptyInput({
      checkins: [10, 8, 6, 4, 2, 0].map((k, i) =>
        makeCheckin(d(k), { mood: (Math.min(5, i + 1)) as Rating }),
      ),
      activities: [4, 3, 2, 0].map((k) => makeActivity(d(k), 'social', 30)),
    });
    expect(runRule('activity_variety_mood', singleType)).toBeNull();
  });
});

describe('sleep_consistency_long_window', () => {
  it('fires a milestone when 14+ nights in 28d stay within <= 45 min bedtime spread', () => {
    const input = emptyInput({
      sleep: Array.from({ length: 14 }, (_, i) =>
        makeSleep(d(13 - i), 460 + (i % 2) * 20),
      ),
    });
    const insight = runRule('sleep_consistency_long_window', input);
    expect(insight?.kind).toBe('milestone');
    expect(insight?.confidence?.level).toBe('enough');
  });

  it('fires an observation when 14+ nights in 28d exceed 65 min circular spread, and returns null at 13 nights', () => {
    const wide = emptyInput({
      sleep: Array.from({ length: 14 }, (_, i) =>
        makeSleep(d(13 - i), 450, {
          bedtime: i % 2 === 0 ? `${d(14 - i)}T21:00:00` : `${d(13 - i)}T02:00:00`,
        }),
      ),
    });
    expect(runRule('sleep_consistency_long_window', wide)?.kind).toBe('observation');

    const thirteen = emptyInput({ sleep: wide.sleep.slice(0, 13) });
    expect(runRule('sleep_consistency_long_window', thirteen)).toBeNull();
  });
});

// ---------- confidence thresholds, overview 1-per-pillar, feedback, demo ----------

describe('data confidence, overview curation, and feedback filtering', () => {
  it('classifies confidence levels strictly at thresholds', () => {
    expect(classifyDataConfidence(6, 0.8)).toBe('low');
    expect(classifyDataConfidence(7, 0.35)).toBe('low');
    expect(classifyDataConfidence(8, 0.3)).toBe('moderate');
    expect(classifyDataConfidence(9, 0.45)).toBe('moderate');
    expect(classifyDataConfidence(13, 0.5)).toBe('moderate');
    expect(classifyDataConfidence(14, 0.44)).toBe('moderate');
    expect(classifyDataConfidence(14, 0.45)).toBe('enough');
    expect(classifyDataConfidence(21, 0.3)).toBe('enough');

    expect(classifyDataConfidence(6)).toBe('low');
    expect(classifyDataConfidence(7)).toBe('moderate');
    expect(classifyDataConfidence(14)).toBe('enough');

    expect(buildConfidence({ sampleSize: 9, unit: 'day', paired: true, effectStrength: 0.4 })).toEqual({
      level: 'moderate',
      summary: 'Based on 9 days of paired data',
      sampleSize: 9,
    });
  });

  it('surfaces at most one insight per pillar on Overview', () => {
    const all = computeInsights(fullInput(), TODAY);
    const overview = selectOverviewInsights(all, 3);
    expect(overview).toHaveLength(3);
    expect(new Set(overview.map((i) => i.pillar)).size).toBe(3);
  });

  it('handles permanent dismissal and exact 14-day snooze expiry', () => {
    const until = computeSnoozeUntil(TODAY, 14);
    expect(until).toBe('2026-11-30');

    const snoozedFb = {
      id: 'sleep_below_target',
      insightId: 'sleep_below_target',
      status: 'snoozed' as const,
      snoozeUntil: until,
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    };
    const dismissedFb = {
      id: 'meal_regularity',
      insightId: 'meal_regularity',
      status: 'dismissed' as const,
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    };

    expect(isInsightSuppressed(snoozedFb, '2026-11-29')).toBe(true);
    expect(isInsightSuppressed(snoozedFb, '2026-11-30')).toBe(false);
    expect(isInsightSuppressed(dismissedFb, '2027-06-01')).toBe(true);

    const insights = computeInsights(fullInput(), TODAY);
    const partitioned = partitionInsightsByFeedback(insights, [snoozedFb, dismissedFb], TODAY);
    expect(partitioned.active.some((i) => i.id === 'sleep_below_target')).toBe(false);
    expect(partitioned.active.some((i) => i.id === 'meal_regularity')).toBe(false);
    expect(partitioned.dismissed.map((e) => e.insightId)).toEqual(['meal_regularity']);
    expect(partitioned.snoozed.map((e) => e.insightId)).toEqual(['sleep_below_target']);
  });

  it('runs cleanly on generateDemoData without noise or duplicate sleep-timing rules', () => {
    const demo14 = generateDemoData(14, 42, parseISO(TODAY));
    const demo30 = generateDemoData(30, 42, parseISO(TODAY));
    const out14 = computeInsights(demo14, TODAY);
    const out30 = computeInsights(demo30, TODAY);
    expect(out14.length).toBeGreaterThan(0);
    expect(out30.length).toBeGreaterThan(0);
    expect(new Set(out30.map((i) => i.id)).size).toBe(out30.length);
  });
});

// ---------- computeInsights orchestration ----------

describe('computeInsights', () => {
  it('returns [] for empty input (every rule null)', () => {
    expect(computeInsights(emptyInput(), TODAY)).toEqual([]);
    for (const rule of RULES) expect(rule.run(emptyInput(), TODAY)).toBeNull();
  });

  it('caps at 8, observations first, then reflections, then milestones, in registration order', () => {
    const insights = computeInsights(fullInput(), TODAY);
    expect(insights).toHaveLength(8);
    expect(insights.map((i) => i.id)).toEqual([
      'sleep_below_target',
      'bedtime_irregular',
      'sleep_focus_pairing',
      'low_focus_streak',
      'long_sessions_no_breaks',
      'meal_regularity',
      'movement_consistency',
      'learning_variety',
    ]);
    expect(insights.map((i) => i.kind)).toEqual([
      'observation', 'observation', 'observation',
      'reflection', 'reflection', 'reflection',
      'milestone', 'milestone',
    ]);
    expect(new Set(insights.map((i) => i.id)).size).toBe(8);
  });

  it('is deterministic and independent of input array ordering', () => {
    const a = computeInsights(fullInput(), TODAY);
    expect(computeInsights(fullInput(), TODAY)).toEqual(a);
    const src = fullInput();
    const reversed: InsightInput = {
      ...src,
      sleep: [...src.sleep].reverse(),
      checkins: [...src.checkins].reverse(),
      focus: [...src.focus].reverse(),
      movement: [...src.movement].reverse(),
      nutrition: [...src.nutrition].reverse(),
    };
    expect(computeInsights(reversed, TODAY)).toEqual(a);
  });

  it('never mutates its input (deep-frozen input works identically)', () => {
    const expected = computeInsights(fullInput(), TODAY);
    expect(computeInsights(deepFreeze(fullInput()), TODAY)).toEqual(expected);
  });

  it('registers unique rule ids with positive minSamples, and insight ids match rule ids', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const rule of RULES) expect(rule.minSamples).toBeGreaterThan(0);
    for (const insight of computeInsights(fullInput(), TODAY)) {
      expect(RULES.some((r) => r.id === insight.id)).toBe(true);
    }
  });
});

// ---------- copy safety & scientific honesty ----------

describe('insight copy safety', () => {
  const BANNED: readonly RegExp[] = [
    /\bscore/i, /\bbrain health\b/i, /\bgrew\b/i, /\bgrow/i, /\bstrengthen/i,
    /\biq\b/i, /\bboost/i, /\bdiagnos/i, /\bdisorder/i, /\badhd\b/i,
    /\bdepress/i, /\banxiety\b/i, /\bunhealthy\b/i, /\blazy\b/i, /\bfail/i,
    /\bsham(e|ing)\b/i, /\bguilt/i, /\bcalorie/i, /\bmacro\b/i, /\boptimiz/i, /\bobes/i,
  ];
  const VALID_REGIONS = new Set([
    'prefrontal', 'parietal', 'temporal', 'occipital', 'cerebellum', 'hippocampus', 'amygdala',
  ]);

  const activityVarietyInput = emptyInput({
    activities: [
      makeActivity(d(4), 'social', 30),
      makeActivity(d(2), 'music', 25),
      makeActivity(d(0), 'novelty', 20),
    ],
  });

  const studyHeavyInput = emptyInput({
    focus: [4, 3, 2, 1].map((k) => makeFocus(d(k), { durationMin: 45 })),
  });

  const readingOnlyInput = emptyInput({
    focus: [8, 5, 2].map((k) =>
      makeFocus(d(k), { method: 'deep_reading', durationMin: 30, practicedRetrieval: false }),
    ),
  });

  const sessionLenInput = emptyInput({
    focus: [20, 25, 35, 50, 65, 80].map((dur, i) =>
      makeFocus(d(10 - i), { durationMin: dur, focusRating: ([1, 2, 3, 4, 5, 5][i] as Rating) }),
    ),
  });

  const weekdayWeekendInput = emptyInput({
    sleep: [
      makeSleep(d(6), 420),
      makeSleep(d(5), 420),
      makeSleep(d(4), 420),
      makeSleep(d(3), 420),
      makeSleep(d(2), 540, { wakeTime: `${d(2)}T09:00:00`, bedtime: `${d(2)}T00:00:00` }),
      makeSleep(d(1), 540, { wakeTime: `${d(1)}T09:00:00`, bedtime: `${d(1)}T00:00:00` }),
    ],
  });

  const outdoorInput = emptyInput({
    checkins: [5, 10, 20, 40, 55, 70].map((outdoorMin, i) =>
      makeCheckin(d(6 - i), {
        outdoorMin,
        mood: ([2, 2, 3, 4, 4, 5][i] as Rating),
      }),
    ),
  });

  const mindfulStressInput = emptyInput({
    checkins: [
      makeCheckin(d(10), { stress: 2 }),
      makeCheckin(d(9), { stress: 2 }),
      makeCheckin(d(8), { stress: 1 }),
      makeCheckin(d(5), { stress: 4 }),
      makeCheckin(d(4), { stress: 4 }),
      makeCheckin(d(3), { stress: 5 }),
    ],
    mindfulness: [10, 9, 8].map((k) => makeMindfulness(d(k), 5)),
  });

  const activityMoodInput = emptyInput({
    checkins: [
      makeCheckin(d(15), { mood: 2 }),
      makeCheckin(d(14), { mood: 2 }),
      makeCheckin(d(13), { mood: 2 }),
      makeCheckin(d(4), { mood: 4 }),
      makeCheckin(d(2), { mood: 5 }),
      makeCheckin(d(0), { mood: 5 }),
    ],
    activities: [
      makeActivity(d(4), 'social', 30),
      makeActivity(d(3), 'creative', 25),
      makeActivity(d(2), 'music', 25),
      makeActivity(d(0), 'novelty', 20),
    ],
  });

  const steadyMonthSleepInput = emptyInput({
    sleep: Array.from({ length: 14 }, (_, i) => makeSleep(d(13 - i), 460 + (i % 2) * 20)),
  });

  // v0.4 planner fixture: fires all four planner rules at once.
  const plannerTasks: Task[] = [
    { ...base(), id: 'p-deep', title: 'Deep work', kind: 'deep', estimateMin: 300, status: 'active' },
    { ...base(), id: 'p-shallow', title: 'Admin', kind: 'shallow', estimateMin: 300, status: 'active' },
  ];
  const plannerBlock = (id: string, over: Partial<Block> = {}): Block => ({
    ...base(), id, taskId: 'p-deep', order: 0, plannedMin: 50, status: 'done', plannedDate: d(1), ...over,
  });
  const plannerDays = [1, 2, 3].map((offset) => {
    const date = d(offset);
    const plan: DayPlan = {
      ...base(), id: `p-plan-${offset}`, date, wakeTime: '07:00', sleepTargetMin: 480, windDownMin: 45,
      maxStudyBlockMin: 50, breakMin: 10, bufferMin: 10, movementGoalMin: 30, preferRecoverySpacing: true,
      commitments: [{ id: `p-c-${offset}`, title: 'Classes', startTime: '07:00', endTime: '20:00' }],
      studyGoals: [], blocks: [], unscheduled: [],
    };
    const dayBlocks: Block[] = [
      plannerBlock(`p-s${offset}-1`, { taskId: 'p-shallow', plannedMin: 30, status: 'scheduled', plannedDate: date, plannedStart: '20:00' }),
      plannerBlock(`p-s${offset}-2`, { taskId: 'p-shallow', plannedMin: 30, status: 'scheduled', plannedDate: date, plannedStart: '20:45' }),
      plannerBlock(`p-s${offset}-3`, { taskId: 'p-shallow', plannedMin: 30, status: 'scheduled', plannedDate: date, plannedStart: '21:30' }),
      plannerBlock(`p-l${offset}-1`, { taskId: 'p-shallow', plannedMin: 60, status: 'todo', plannedDate: date }),
      plannerBlock(`p-l${offset}-2`, { taskId: 'p-shallow', plannedMin: 60, status: 'todo', plannedDate: date }),
    ];
    return { plan, dayBlocks };
  });
  const plannerMeta: DayPlanMeta[] = [0, 1, 2].map((offset) => ({
    ...base(), id: `p-meta-${offset}`, date: d(offset), shutdownDone: true,
  }));
  const plannerScanInput = emptyInput({
    tasks: plannerTasks,
    blocks: [
      ...plannerDays.flatMap((day) => day.dayBlocks),
      ...Array.from({ length: 6 }, (_, i) =>
        plannerBlock(`p-e${i}`, { plannedMin: 50, actualMin: 62, plannedDate: d(4 + i) }),
      ),
    ],
    dayPlans: plannerDays.map((day) => day.plan),
    dayPlanMeta: plannerMeta,
  });

  // Cover every registered rule across positive/negative/v0.2/v0.4 fixtures.
  const allInsights: Insight[] = [
    fullInput(),
    negativePairingInput(),
    activityVarietyInput,
    studyHeavyInput,
    readingOnlyInput,
    sessionLenInput,
    weekdayWeekendInput,
    outdoorInput,
    mindfulStressInput,
    activityMoodInput,
    steadyMonthSleepInput,
    plannerScanInput,
  ].flatMap((input) =>
    RULES.map((r) => r.run(input, TODAY)).filter((i): i is Insight => i !== null),
  );

  it('covers every rule at least once across the scan fixtures', () => {
    expect(new Set(allInsights.map((i) => i.id)).size).toBe(RULES.length);
  });

  it('contains no banned phrases in any title, body, evidence, caveat, or education', () => {
    for (const insight of allInsights) {
      const text = [insight.title, insight.body, insight.caveat, insight.education ?? '', ...insight.evidence].join('\n');
      for (const pattern of BANNED) expect(text).not.toMatch(pattern);
    }
  });

  it('always includes concrete evidence and a self-report caveat', () => {
    for (const insight of allInsights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.caveat).toMatch(/self-reported/i);
    }
  });

  it('phrases brain-region links as educational associations only', () => {
    for (const insight of allInsights) {
      if (insight.education !== undefined) {
        expect(insight.education).toMatch(/commonly involves|associated with/i);
      }
      for (const region of insight.regions ?? []) expect(VALID_REGIONS.has(region)).toBe(true);
    }
  });
});
