import { describe, expect, it } from 'vitest';
import { format, parseISO, subDays, subMinutes } from 'date-fns';
import type {
  DailyCheckin,
  FocusSession,
  Insight,
  InsightInput,
  ISODate,
  MovementLog,
  NutritionLog,
  Rating,
  SleepLog,
  UserSettings,
} from '@/types/domain';
import { RULES } from './rules';
import { computeInsights } from './index';

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

  // fullInput fires all 9 rules; negativePairingInput adds the inverse-correlation wording.
  const allInsights: Insight[] = [fullInput(), negativePairingInput()].flatMap((input) =>
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
