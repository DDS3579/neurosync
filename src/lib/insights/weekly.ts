import { activityToRegionIntensity, BRAIN_REGIONS } from '@/data/brainRegions';
import type {
  ActivityKind,
  InsightInput,
  ISODate,
  LearningMethod,
  PersonalActivityType,
  RegionId,
  SleepLog,
} from '@/types/domain';
import { addDays, format, parseISO } from 'date-fns';
import { groupByDate, mean, round1 } from './stats';

export interface WeeklyReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  sleep: { avgMin: number | null; nightsLogged: number; nightsBelowTarget: number; bedtimeSpreadMin: number | null };
  focus: {
    totalMin: number;
    sessions: number;
    avgFocusRating: number | null;
    methodsUsed: LearningMethod[];
    methodBreakdown: { method: LearningMethod; sessions: number; totalMin: number }[];
    retrievalSessions: number;
    reviewedPriorSessions: number;
  };
  movement: { daysActive: number; totalMin: number };
  wellbeing: { avgMood: number | null; avgStress: number | null; avgEnergy: number | null; avgConcentration: number | null; checkins: number };
  nutrition: { daysLogged: number; regularMealDays: number; avgWater: number | null };
  mind: {
    mindfulnessSessions: number;
    mindfulnessMin: number;
    journalEntries: number;
    gratitudeDays: number;
  };
  activities: {
    totalLogs: number;
    totalMin: number;
    distinctTypes: number;
    typesUsed: PersonalActivityType[];
    byType: { type: PersonalActivityType; count: number; totalMin: number }[];
  };
  brainActivity: {
    regions: Partial<Record<RegionId, number>>;
    topRegions: { region: RegionId; intensity: number }[];
  };
  daily: {
    date: ISODate;
    sleepHours: number | null;
    focusMin: number;
    movementMin: number;
    mood: number | null;
    concentration: number | null;
    mindAndActivityMin: number;
  }[];
  vsPreviousWeek: Record<string, { delta: number; direction: 'up' | 'down' | 'flat' }>;
  highlights: string[];
  reflectionPrompts: string[];
}

// ---------- private helpers ----------

const isoAdd = (iso: ISODate, days: number): ISODate => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');

// 'YYYY-MM-DD' compares lexicographically in chronological order; windows are inclusive.
function inWindow<T extends { date: ISODate }>(items: readonly T[], start: ISODate, end: ISODate): T[] {
  return items.filter((it) => it.date >= start && it.date <= end);
}

const bedtimeMinutes = (log: SleepLog): number => {
  const d = parseISO(log.bedtime); // offset-less ISO parses as local time (matches local-first logging)
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Circular SD of minutes-of-day (Mardia), so 23:30 and 00:30 count as 60 min apart.
 * Null with fewer than 2 bedtimes (a spread needs something to spread across).
 * Capped at 720 for interpretability as R → 0.
 */
function bedtimeSpread(bedtimes: readonly number[]): number | null {
  if (bedtimes.length < 2) return null;
  let c = 0;
  let s = 0;
  for (const m of bedtimes) {
    const theta = ((((m % 1440) + 1440) % 1440) / 1440) * 2 * Math.PI;
    c += Math.cos(theta);
    s += Math.sin(theta);
  }
  c /= bedtimes.length;
  s /= bedtimes.length;
  const r = Math.hypot(c, s);
  if (r >= 1 - 1e-12) return 0;
  if (r <= 1e-12) return 720;
  return Math.min(720, Math.sqrt(-2 * Math.log(r)) * (1440 / (2 * Math.PI)));
}

function fmtDur(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const METHOD_TO_ACTIVITY: Record<LearningMethod, ActivityKind> = {
  active_recall: 'active_recall',
  spaced_repetition: 'spaced_repetition',
  problem_solving: 'problem_solving',
  deep_reading: 'reading',
  skill_practice: 'skill_practice',
  teaching: 'teaching',
};

type Sections = Pick<
  WeeklyReport,
  'sleep' | 'focus' | 'movement' | 'wellbeing' | 'nutrition' | 'mind' | 'activities'
>;

function computeSections(input: InsightInput, start: ISODate, end: ISODate): Sections {
  const nights = inWindow(input.sleep, start, end);
  const durations = nights.map((n) => n.durationMin);
  const sleepAvg = mean(durations);
  const spread = bedtimeSpread(nights.map(bedtimeMinutes));

  const sessions = inWindow(input.focus, start, end);
  const focusAvg = mean(sessions.map((s) => s.focusRating));
  const methodMap = new Map<LearningMethod, { sessions: number; totalMin: number }>();
  let retrievalSessions = 0;
  let reviewedPriorSessions = 0;
  for (const s of sessions) {
    const prev = methodMap.get(s.method) ?? { sessions: 0, totalMin: 0 };
    methodMap.set(s.method, {
      sessions: prev.sessions + 1,
      totalMin: prev.totalMin + s.durationMin,
    });
    if (s.practicedRetrieval === true || s.method === 'active_recall') retrievalSessions += 1;
    if (s.reviewedPrior === true || s.method === 'spaced_repetition') reviewedPriorSessions += 1;
  }
  const methodsUsed = [...methodMap.keys()].sort();
  const methodBreakdown = methodsUsed.map((method) => ({
    method,
    sessions: methodMap.get(method)!.sessions,
    totalMin: methodMap.get(method)!.totalMin,
  }));

  const movement = inWindow(input.movement, start, end);

  const checkins = inWindow(input.checkins, start, end);
  const avgOf = (pick: (c: (typeof checkins)[number]) => number): number | null => {
    const m = mean(checkins.map(pick));
    return m === null ? null : round1(m);
  };

  // One nutrition entry per day: a later log for the same date supersedes earlier ones.
  const nutritionByDate = new Map<ISODate, (typeof input.nutrition)[number]>();
  for (const log of inWindow(input.nutrition, start, end)) nutritionByDate.set(log.date, log);
  const nutritionDays = [...nutritionByDate.values()];
  const waterAvg = mean(nutritionDays.map((n) => n.waterGlasses));

  const mindfulness = inWindow(input.mindfulness ?? [], start, end);
  const journal = inWindow(input.journal ?? [], start, end);
  const gratitude = inWindow(input.gratitude ?? [], start, end);

  const activityLogs = inWindow(input.activities ?? [], start, end);
  const activityMap = new Map<PersonalActivityType, { count: number; totalMin: number }>();
  for (const act of activityLogs) {
    const prev = activityMap.get(act.type) ?? { count: 0, totalMin: 0 };
    activityMap.set(act.type, {
      count: prev.count + 1,
      totalMin: prev.totalMin + act.durationMin,
    });
  }
  const typesUsed = [...activityMap.keys()].sort();
  const byType = typesUsed.map((type) => ({
    type,
    count: activityMap.get(type)!.count,
    totalMin: activityMap.get(type)!.totalMin,
  }));

  return {
    sleep: {
      avgMin: sleepAvg === null ? null : round1(sleepAvg),
      nightsLogged: nights.length,
      nightsBelowTarget: nights.filter((n) => n.durationMin < input.settings.sleepTargetMin).length,
      bedtimeSpreadMin: spread === null ? null : round1(spread),
    },
    focus: {
      totalMin: sessions.reduce((a, s) => a + s.durationMin, 0),
      sessions: sessions.length,
      avgFocusRating: focusAvg === null ? null : round1(focusAvg),
      methodsUsed,
      methodBreakdown,
      retrievalSessions,
      reviewedPriorSessions,
    },
    movement: {
      daysActive: new Set(movement.map((m) => m.date)).size,
      totalMin: movement.reduce((a, m) => a + m.durationMin, 0),
    },
    wellbeing: {
      avgMood: avgOf((c) => c.mood),
      avgStress: avgOf((c) => c.stress),
      avgEnergy: avgOf((c) => c.energy),
      avgConcentration: avgOf((c) => c.concentration),
      checkins: checkins.length,
    },
    nutrition: {
      daysLogged: nutritionDays.length,
      regularMealDays: nutritionDays.filter((n) => n.regularMeals).length,
      avgWater: waterAvg === null ? null : round1(waterAvg),
    },
    mind: {
      mindfulnessSessions: mindfulness.length,
      mindfulnessMin: mindfulness.reduce((sum, m) => sum + m.durationMin, 0),
      journalEntries: journal.length,
      gratitudeDays: new Set(gratitude.map((g) => g.date)).size,
    },
    activities: {
      totalLogs: activityLogs.length,
      totalMin: activityLogs.reduce((sum, a) => sum + a.durationMin, 0),
      distinctTypes: typesUsed.length,
      typesUsed,
      byType,
    },
  };
}

/**
 * Comparison keys and per-metric "flat" tolerances. A key is omitted when either
 * week lacks data (missing ≠ 0); totals/counts are only compared when at least
 * one week actually logged something.
 */
const COMPARISONS: readonly { key: string; tolerance: number; pick: (s: Sections) => number | null; needsData: boolean }[] = [
  { key: 'sleepAvgMin', tolerance: 15, pick: (s) => s.sleep.avgMin, needsData: false },
  { key: 'focusTotalMin', tolerance: 30, pick: (s) => s.focus.totalMin, needsData: true },
  { key: 'focusSessions', tolerance: 1, pick: (s) => s.focus.sessions, needsData: true },
  { key: 'movementDaysActive', tolerance: 0, pick: (s) => s.movement.daysActive, needsData: true },
  { key: 'movementTotalMin', tolerance: 20, pick: (s) => s.movement.totalMin, needsData: true },
  { key: 'avgMood', tolerance: 0.3, pick: (s) => s.wellbeing.avgMood, needsData: false },
  { key: 'avgStress', tolerance: 0.3, pick: (s) => s.wellbeing.avgStress, needsData: false },
  { key: 'avgEnergy', tolerance: 0.3, pick: (s) => s.wellbeing.avgEnergy, needsData: false },
  { key: 'avgConcentration', tolerance: 0.3, pick: (s) => s.wellbeing.avgConcentration, needsData: false },
  { key: 'avgWater', tolerance: 1, pick: (s) => s.nutrition.avgWater, needsData: false },
  { key: 'mindfulnessMin', tolerance: 5, pick: (s) => s.mind.mindfulnessMin, needsData: true },
  { key: 'activitiesMin', tolerance: 15, pick: (s) => s.activities.totalMin, needsData: true },
  { key: 'activitiesDistinctTypes', tolerance: 0, pick: (s) => s.activities.distinctTypes, needsData: true },
];

function bestFocusDay(input: InsightInput, start: ISODate, end: ISODate): { date: ISODate; avg: number } | null {
  const perDay: { date: ISODate; avg: number }[] = [];
  for (const [date, list] of groupByDate(inWindow(input.focus, start, end))) {
    const m = mean(list.map((s) => s.focusRating));
    if (m !== null) perDay.push({ date, avg: m });
  }
  perDay.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let best: { date: ISODate; avg: number } | null = null;
  for (const day of perDay) if (best === null || day.avg > best.avg) best = day; // strict > keeps earliest on ties
  return best;
}

function buildWeekBrainActivity(input: InsightInput, start: ISODate, end: ISODate): WeeklyReport['brainActivity'] {
  const items: { kind: ActivityKind; minutes: number }[] = [];

  for (const s of inWindow(input.focus, start, end)) {
    if (s.durationMin > 0) items.push({ kind: METHOD_TO_ACTIVITY[s.method], minutes: s.durationMin });
  }
  for (const m of inWindow(input.movement, start, end)) {
    if (m.durationMin > 0) items.push({ kind: 'exercise', minutes: m.durationMin });
  }
  for (const ms of inWindow(input.mindfulness ?? [], start, end)) {
    if (ms.durationMin > 0) items.push({ kind: 'mindfulness', minutes: ms.durationMin });
  }
  for (const a of inWindow(input.activities ?? [], start, end)) {
    if (a.durationMin > 0) items.push({ kind: a.type, minutes: a.durationMin });
  }
  for (const sl of inWindow(input.sleep, start, end)) {
    if (sl.durationMin > 0) items.push({ kind: 'sleep_rest', minutes: Math.max(15, Math.round(sl.durationMin / 16)) });
  }

  const regions = activityToRegionIntensity(items);
  const topRegions = BRAIN_REGIONS
    .map((r) => ({ region: r.id, intensity: regions[r.id] ?? 0 }))
    .filter((entry) => entry.intensity > 0)
    .sort((a, b) => b.intensity - a.intensity);

  return { regions, topRegions };
}

function buildDailySeries(input: InsightInput, weekStart: ISODate, weekEnd: ISODate): WeeklyReport['daily'] {
  const sleepByDate = new Map<ISODate, SleepLog>();
  for (const sl of inWindow(input.sleep, weekStart, weekEnd)) sleepByDate.set(sl.date, sl);

  const checkinByDate = new Map<ISODate, (typeof input.checkins)[number]>();
  for (const c of inWindow(input.checkins, weekStart, weekEnd)) checkinByDate.set(c.date, c);

  const focusMinByDate = new Map<ISODate, number>();
  for (const f of inWindow(input.focus, weekStart, weekEnd)) {
    focusMinByDate.set(f.date, (focusMinByDate.get(f.date) ?? 0) + f.durationMin);
  }

  const movementMinByDate = new Map<ISODate, number>();
  for (const m of inWindow(input.movement, weekStart, weekEnd)) {
    movementMinByDate.set(m.date, (movementMinByDate.get(m.date) ?? 0) + m.durationMin);
  }

  const mindActMinByDate = new Map<ISODate, number>();
  for (const ms of inWindow(input.mindfulness ?? [], weekStart, weekEnd)) {
    mindActMinByDate.set(ms.date, (mindActMinByDate.get(ms.date) ?? 0) + ms.durationMin);
  }
  for (const a of inWindow(input.activities ?? [], weekStart, weekEnd)) {
    mindActMinByDate.set(a.date, (mindActMinByDate.get(a.date) ?? 0) + a.durationMin);
  }

  const out: WeeklyReport['daily'] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = isoAdd(weekStart, offset);
    const sl = sleepByDate.get(date);
    const ck = checkinByDate.get(date);
    out.push({
      date,
      sleepHours: sl ? Number((sl.durationMin / 60).toFixed(2)) : null,
      focusMin: focusMinByDate.get(date) ?? 0,
      movementMin: movementMinByDate.get(date) ?? 0,
      mood: ck ? ck.mood : null,
      concentration: ck ? ck.concentration : null,
      mindAndActivityMin: mindActMinByDate.get(date) ?? 0,
    });
  }
  return out;
}

// ---------- public API ----------

export function buildWeeklyReport(input: InsightInput, weekStartISO: ISODate): WeeklyReport {
  const weekStart = weekStartISO;
  const weekEnd = isoAdd(weekStartISO, 6);
  const current = computeSections(input, weekStart, weekEnd);
  const previous = computeSections(input, isoAdd(weekStartISO, -7), isoAdd(weekStartISO, -1));

  const vsPreviousWeek: WeeklyReport['vsPreviousWeek'] = {};
  for (const { key, tolerance, pick, needsData } of COMPARISONS) {
    const cur = pick(current);
    const prev = pick(previous);
    if (cur === null || prev === null) continue;
    if (needsData && cur === 0 && prev === 0) continue;
    const raw = cur - prev;
    vsPreviousWeek[key] = {
      delta: round1(raw),
      direction: Math.abs(raw) <= tolerance + 1e-9 ? 'flat' : raw > 0 ? 'up' : 'down',
    };
  }

  const highlights: string[] = [];
  const { sleep, focus, movement, wellbeing, mind, activities } = current;
  if (sleep.nightsLogged > 0 && sleep.avgMin !== null) {
    highlights.push(`You logged ${plural(sleep.nightsLogged, 'night')} of sleep, averaging ${fmtDur(sleep.avgMin)}.`);
  }
  if (focus.sessions > 0) {
    const variety = focus.methodsUsed.length >= 3 ? `, spanning ${focus.methodsUsed.length} different methods` : '';
    highlights.push(`${plural(focus.sessions, 'focus session')} added up to ${fmtDur(focus.totalMin)} of practice${variety}.`);
  }
  const best = bestFocusDay(input, weekStart, weekEnd);
  if (best !== null) {
    highlights.push(`Your best-focus day was ${format(parseISO(best.date), 'EEEE')} (${round1(best.avg)}/5 average).`);
  }
  if (movement.daysActive >= 4) {
    highlights.push(`Movement showed up on ${movement.daysActive} days — a steady rhythm.`);
  } else if (movement.daysActive > 0) {
    highlights.push(`You moved on ${plural(movement.daysActive, 'day')} this week.`);
  }
  if (mind.mindfulnessSessions > 0) {
    highlights.push(`You paused for ${plural(mind.mindfulnessSessions, 'mindfulness session')} (${fmtDur(mind.mindfulnessMin)}).`);
  }
  if (activities.totalLogs > 0) {
    highlights.push(`Beyond study, you logged ${plural(activities.totalLogs, 'activity')} across ${plural(activities.distinctTypes, 'category')}.`);
  }
  if (wellbeing.checkins >= 5) {
    highlights.push(`${wellbeing.checkins} check-ins — a week of noticing how you are.`);
  }
  if (highlights.length === 0) {
    highlights.push('A quiet week in the logs — they only show what was recorded, not everything you lived.');
  }

  const prompts: string[] = [];
  if (focus.sessions > 0) prompts.push('What made your best-focus day different?');
  if (sleep.nightsLogged > 0) prompts.push('What did the evening before your longest night look like?');
  if (movement.daysActive > 0) prompts.push('How did the days you moved feel in your body and mood?');
  if (activities.totalLogs > 0 || mind.mindfulnessSessions > 0) {
    prompts.push('Which unhurried activity or quiet pause felt most restorative this week?');
  }
  if (wellbeing.checkins > 0) prompts.push('Which check-in surprised you, and what was happening around it?');
  prompts.push('What is one small thing from this week you would like to keep?');
  prompts.push('What would make next week feel a little easier?');

  return {
    weekStart,
    weekEnd,
    ...current,
    brainActivity: buildWeekBrainActivity(input, weekStart, weekEnd),
    daily: buildDailySeries(input, weekStart, weekEnd),
    vsPreviousWeek,
    highlights: highlights.slice(0, 5),
    reflectionPrompts: prompts.slice(0, 3),
  };
}
