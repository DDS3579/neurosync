import type {
  DailyCheckin,
  Insight,
  InsightInput,
  ISODate,
  LearningMethod,
  NutritionLog,
  PersonalActivityType,
  Pillar,
  SleepLog,
} from '@/types/domain';
import { format, getDay, parseISO, subDays } from 'date-fns';
import { buildConfidence } from './confidence';
import { PLANNER_RULES } from './plannerRules';
import {
  circularMeanMinutes,
  circularStdMinutes,
  clamp,
  groupByDate,
  linearSlope,
  mean,
  pairByDate,
  pearson,
  round1,
  type DateValue,
} from './stats';

export interface InsightRule {
  id: string;
  pillar: Pillar;
  /** Minimum size of the rule's primary series; run() enforces this and any extra thresholds. */
  minSamples: number;
  /** Optional shared topic key; computeInsights keeps only the highest-ranked rule per group. */
  dedupeGroup?: string;
  run(input: InsightInput, today: ISODate): Insight | null;
}

// ---------- private helpers (pure, no clock access — everything derives from `today`) ----------

const isoBefore = (today: ISODate, daysBack: number): ISODate =>
  format(subDays(parseISO(today), daysBack), 'yyyy-MM-dd');

/** Inclusive window [today - (n-1), today]. Future-dated logs are excluded. */
function lastNDays<T extends { date: ISODate }>(items: readonly T[], today: ISODate, n: number): T[] {
  const start = isoBefore(today, n - 1);
  // 'YYYY-MM-DD' compares lexicographically in chronological order — no timezone math needed.
  return items.filter((it) => it.date >= start && it.date <= today);
}

const uniqueSortedDates = (items: readonly { date: ISODate }[]): ISODate[] =>
  [...new Set(items.map((it) => it.date))].sort();

function fmtDur(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

function fmtClock(minutesOfDay: number): string {
  const m = Math.round(((minutesOfDay % 1440) + 1440) % 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

const dayLabel = (d: ISODate): string => format(parseISO(d), 'MMM d');

/**
 * Local wall-clock minutes of a bedtime. Offset-less ISO strings parse as local time
 * (date-fns), which matches local-first logging; the circular stats handle the midnight wrap.
 */
const bedtimeMinutes = (log: SleepLog): number => {
  const d = parseISO(log.bedtime);
  return d.getHours() * 60 + d.getMinutes();
};

const METHOD_LABELS: Record<LearningMethod, string> = {
  active_recall: 'active recall',
  spaced_repetition: 'spaced repetition',
  problem_solving: 'problem solving',
  deep_reading: 'deep reading',
  skill_practice: 'skill practice',
  teaching: 'teaching',
};

const ACTIVITY_LABELS: Record<PersonalActivityType, string> = {
  social: 'social time',
  creative: 'creative work',
  music: 'music practice',
  language_learning: 'language learning',
  puzzles_games: 'puzzles & games',
  new_hobby: 'new hobby',
  novelty: 'tried something new',
};

/**
 * One focus signal per logged day: check-in concentration when present,
 * otherwise the mean of that day's session focus ratings. If several check-ins
 * share a date, the later entry in the array supersedes earlier ones.
 */
function focusSignalByDate(input: InsightInput, today: ISODate): Map<ISODate, number> {
  const byDate = new Map<ISODate, number>();
  const sessions = input.focus.filter((s) => s.date <= today);
  for (const [date, list] of groupByDate(sessions)) {
    const m = mean(list.map((s) => s.focusRating));
    if (m !== null) byDate.set(date, m);
  }
  for (const c of input.checkins) {
    if (c.date <= today) byDate.set(c.date, c.concentration);
  }
  return byDate;
}

const minOf = (xs: readonly number[]): number => xs.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
const maxOf = (xs: readonly number[]): number => xs.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);

/** Shortest signed minute delta on a 24-hour clock, in (-720, 720]. */
function signedClockDiffMin(aMin: number, bMin: number): number {
  let diff = ((aMin - bMin) % 1440 + 1440) % 1440;
  if (diff > 720) diff -= 1440;
  return diff;
}

// ---------- rules (registration order is the tiebreak for insight ordering) ----------

export const RULES: readonly InsightRule[] = [
  {
    id: 'sleep_below_target',
    pillar: 'sleep',
    minSamples: 3,
    run(input, today) {
      // SleepLog.date is the wake-up date, so "last 7 nights" = wake dates in the window.
      const nights = lastNDays(input.sleep, today, 7);
      if (nights.length < 3) return null;
      const target = input.settings.sleepTargetMin;
      const below = nights.filter((n) => n.durationMin < target);
      if (below.length < 3) return null;
      const durations = nights.map((n) => n.durationMin);
      const avg = mean(durations);
      if (avg === null) return null;
      return {
        id: 'sleep_below_target',
        pillar: 'sleep',
        kind: 'observation',
        title: 'A few shorter nights this week',
        body: `${below.length} of your last ${nights.length} logged nights were shorter than your personal target of ${fmtDur(target)}. Sleep needs differ between people and between seasons of life — this is a gentle observation, not a verdict. For reference, common guidelines suggest 7+ hours for adults and 8–10 for teens; your target is yours to adjust in Settings.`,
        evidence: [
          `${below.length} of ${nights.length} logged nights below ${fmtDur(target)} (last 7 days)`,
          `Average logged sleep: ${fmtDur(avg)}`,
          `Shortest night: ${fmtDur(minOf(durations))}`,
        ],
        caveat:
          'Based on a small sample of self-reported logs. Short nights can have many causes — this pattern does not tell us why, and one week does not define your rest.',
        education:
          'Sleep is associated with memory consolidation, a process that commonly involves the hippocampus.',
        regions: ['hippocampus'],
        confidence: buildConfidence({ sampleSize: nights.length, unit: 'night', windowDays: 7 }),
      };
    },
  },
  {
    id: 'bedtime_irregular',
    pillar: 'sleep',
    minSamples: 5,
    dedupeGroup: 'sleep_timing',
    run(input, today) {
      const nights = lastNDays(input.sleep, today, 7);
      if (nights.length < 5) return null;
      const bedtimes = nights.map(bedtimeMinutes);
      const spread = circularStdMinutes(bedtimes);
      const center = circularMeanMinutes(bedtimes);
      if (spread === null || center === null || spread <= 60) return null;
      return {
        id: 'bedtime_irregular',
        pillar: 'sleep',
        kind: 'observation',
        title: 'Your bedtime has been shifting around',
        body: `Across ${nights.length} logged nights in the last week, your bedtimes varied by roughly ${fmtDur(spread)} around a typical bedtime of ${fmtClock(center)}. Life has seasons, and bedtimes move with them — if you are curious, simply noticing what shapes your evenings could be an interesting observation this week.`,
        evidence: [
          `Nights considered: ${nights.length} (last 7 days)`,
          `Typical bedtime: about ${fmtClock(center)}`,
          `Variation: about ${Math.round(spread)} min (circular SD, so 23:30 and 00:30 count as 60 min apart)`,
        ],
        caveat:
          'Self-reported bedtimes over a small window. Variation is a description of your week, not a problem to fix, and it is not linked to any outcome here.',
        education:
          'Regular sleep timing is associated with steadier circadian rhythms; sleep itself is associated with memory consolidation that commonly involves the hippocampus.',
        regions: ['hippocampus'],
        confidence: buildConfidence({ sampleSize: nights.length, unit: 'night', windowDays: 7 }),
      };
    },
  },
  {
    id: 'sleep_focus_pairing',
    pillar: 'sleep',
    minSamples: 7,
    run(input, today) {
      const signals = focusSignalByDate(input, today);
      const sleepPts: DateValue[] = input.sleep
        .filter((s) => s.date <= today)
        .map((s) => ({ date: s.date, value: s.durationMin }));
      const focusPts: DateValue[] = [...signals].map(([date, value]) => ({ date, value }));
      const pairs = pairByDate(sleepPts, focusPts);
      if (pairs.length < 7) return null;
      const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
      if (r === null || Math.abs(r) < 0.3) return null;
      const sleepVals = pairs.map((p) => p.x);
      const body =
        r > 0
          ? `On ${pairs.length} matched days, nights with longer sleep tended to coincide with higher focus ratings later that day. This is a pattern in your own logs — interesting to notice, not a lever to pull.`
          : `On ${pairs.length} matched days, nights with longer sleep tended to coincide with lower focus ratings later that day. Small samples can show patterns that fade or flip as more days are logged — worth watching with curiosity rather than concern.`;
      return {
        id: 'sleep_focus_pairing',
        pillar: 'sleep',
        kind: 'observation',
        title: 'Sleep and same-day focus move together in your logs',
        body,
        evidence: [
          `Matched days: ${pairs.length}`,
          `Pearson r = ${r.toFixed(2)} (on a −1 to +1 scale)`,
          `Sleep on matched days ranged from ${fmtDur(minOf(sleepVals))} to ${fmtDur(maxOf(sleepVals))}`,
          `Focus signal: check-in concentration, or the day's mean session focus rating when no check-in`,
        ],
        caveat:
          'Correlation is not causation: stress, workload, illness and many other factors could shape both sleep and ratings. All values are self-reported and the sample is small.',
        education:
          'Sleep is associated with memory consolidation that commonly involves the hippocampus, while sustained attention commonly involves prefrontal and parietal regions.',
        regions: ['hippocampus', 'prefrontal', 'parietal'],
        confidence: buildConfidence({
          sampleSize: pairs.length,
          unit: 'day',
          paired: true,
          effectStrength: Math.abs(r),
        }),
      };
    },
  },
  {
    id: 'low_focus_streak',
    pillar: 'focus',
    minSamples: 5,
    run(input, today) {
      const signals = focusSignalByDate(input, today);
      // "Last 5 logged days" = the 5 most recent distinct dates with any focus signal.
      // A full five-day window is required before describing a stretch.
      const recent = [...signals.keys()].sort().reverse().slice(0, 5);
      if (recent.length < 5) return null;
      const low = recent.filter((d) => {
        const v = signals.get(d);
        return v !== undefined && v <= 2;
      });
      if (low.length < 3) return null;
      const first = recent[recent.length - 1];
      const last = recent[0];
      if (first === undefined || last === undefined) return null;
      const range = `${dayLabel(first)} – ${dayLabel(last)}`;
      return {
        id: 'low_focus_streak',
        pillar: 'focus',
        kind: 'reflection',
        title: 'A stretch of lower-focus days',
        body: `${low.length} of your last 5 logged days had focus or concentration ratings of 2 or lower (${range}). Focus naturally ebbs and flows with rest, workload and life context — nothing here needs fixing. If it feels useful, you might reflect on what those days had in common, simply to understand them better.`,
        evidence: [
          `${low.length} of the last 5 logged days rated 2 or lower`,
          `Days considered: ${range}`,
          `Signal: check-in concentration, or mean session focus rating on days without a check-in`,
        ],
        caveat:
          'Self-reported ratings on a handful of days describe your experience, not your ability. This is a reflection prompt, not an assessment of any kind.',
        education:
          'Moment-to-moment concentration commonly involves prefrontal and parietal networks, and it naturally fluctuates with context.',
        regions: ['prefrontal', 'parietal'],
        confidence: buildConfidence({ sampleSize: recent.length, unit: 'day' }),
      };
    },
  },
  {
    id: 'long_sessions_no_breaks',
    pillar: 'focus',
    minSamples: 3,
    run(input, today) {
      const sessions = lastNDays(input.focus, today, 7).filter((s) => s.durationMin > 90);
      if (sessions.length < 3) return null;
      const ordered = [...sessions].sort((a, b) =>
        a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0,
      );
      // "Distractions rising" = positive least-squares slope across the long sessions in time order.
      const slope = linearSlope(ordered.map((_, i) => i), ordered.map((s) => s.distractions));
      if (slope === null || slope <= 0) return null;
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      if (first === undefined || last === undefined) return null;
      const longest = ordered.reduce((m, s) => Math.max(m, s.durationMin), 0);
      return {
        id: 'long_sessions_no_breaks',
        pillar: 'focus',
        kind: 'reflection',
        title: 'Long sessions, rising distractions',
        body: `${ordered.length} sessions in the last week ran longer than 90 minutes, and across those sessions your self-reported distractions trended upward (${first.distractions} → ${last.distractions}). Attention naturally ebbs over long stretches, so this is worth noticing, not worrying about. If you are curious, a small experiment with breaks could be a gentle thing to explore.`,
        evidence: [
          `Sessions over 90 min (last 7 days): ${ordered.length}`,
          `Distractions across those sessions: ${ordered.map((s) => s.distractions).join(' → ')}`,
          `Longest session: ${fmtDur(longest)}`,
        ],
        caveat:
          'A handful of self-reported sessions cannot establish cause and effect; topic difficulty, time of day and busy weeks all play a part.',
        education:
          'Sustained attention commonly involves prefrontal and parietal regions, and vigilance naturally dips during long, unbroken stretches.',
        regions: ['prefrontal', 'parietal'],
        confidence: buildConfidence({ sampleSize: ordered.length, unit: 'session', windowDays: 7 }),
      };
    },
  },
  {
    id: 'meal_regularity',
    pillar: 'nutrition',
    minSamples: 3,
    run(input, today) {
      const logs = lastNDays(input.nutrition, today, 7);
      if (logs.length < 3) return null;
      // One entry per day: a later log for the same date supersedes earlier ones.
      const byDate = new Map<ISODate, NutritionLog>();
      for (const log of logs) byDate.set(log.date, log);
      const days = [...byDate.values()];
      const irregularDates = days.filter((d) => !d.regularMeals).map((d) => d.date).sort();
      if (irregularDates.length < 3) return null;
      return {
        id: 'meal_regularity',
        pillar: 'nutrition',
        kind: 'reflection',
        title: 'Meals were less regular lately',
        body: `On ${irregularDates.length} of your last ${days.length} logged days, meals were not at their usual rhythm. Busy stretches happen to everyone — there are no targets here. If you are curious, what did those days look like? Sometimes the story is simply a full calendar.`,
        evidence: [
          `Days without regular meals: ${irregularDates.length} of ${days.length} logged (last 7 days)`,
          `Dates: ${irregularDates.map(dayLabel).join(', ')}`,
        ],
        caveat:
          'Self-reported flags over a few days; "regular" means whatever it meant to you when logging. This is an invitation to notice, not to change anything.',
        confidence: buildConfidence({ sampleSize: days.length, unit: 'day', windowDays: 7 }),
      };
    },
  },
  {
    id: 'movement_consistency',
    pillar: 'movement',
    minSamples: 4,
    run(input, today) {
      const logs = lastNDays(input.movement, today, 7);
      const days = uniqueSortedDates(logs);
      if (days.length < 4) return null;
      const total = logs.reduce((a, l) => a + l.durationMin, 0);
      const types = [...new Set(logs.map((l) => l.type))].sort();
      return {
        id: 'movement_consistency',
        pillar: 'movement',
        kind: 'milestone',
        title: 'A steady week of movement',
        body: `You logged movement on ${days.length} of the last 7 days — ${fmtDur(total)} in total. That is a lovely rhythm. Rest days belong in the picture too: this celebrates showing up, not a standard to keep up.`,
        evidence: [
          `Active days: ${days.length} of the last 7`,
          `Total logged movement: ${fmtDur(total)}`,
          `Types: ${types.join(', ')}`,
        ],
        caveat:
          'This reflects self-reported logs, not everything you did or did not do. Consistency is one small thread in wellbeing, not a measure of it.',
        education:
          'Movement coordination commonly involves the cerebellum, and physical activity is associated with benefits for mood and memory.',
        regions: ['cerebellum', 'hippocampus'],
        confidence: buildConfidence({ sampleSize: days.length, unit: 'day', windowDays: 7 }),
      };
    },
  },
  {
    id: 'learning_variety',
    pillar: 'learning',
    minSamples: 3,
    run(input, today) {
      const sessions = lastNDays(input.focus, today, 14);
      if (sessions.length < 3) return null;
      const methods = [...new Set(sessions.map((s) => s.method))].sort();
      if (methods.length < 3) return null;
      const labels = methods.map((m) => METHOD_LABELS[m]).join(', ');
      return {
        id: 'learning_variety',
        pillar: 'learning',
        kind: 'milestone',
        title: 'A varied learning toolkit',
        body: `You used ${methods.length} different learning methods over the last two weeks: ${labels}. Mixing approaches keeps practice fresh — nice exploring.`,
        evidence: [
          `Distinct methods (last 14 days): ${methods.length}`,
          `Methods: ${labels}`,
          `Sessions logged: ${sessions.length}`,
        ],
        caveat:
          'Variety is one dimension of practice, counted from self-reported logs. It does not measure learning outcomes or imply any particular result.',
        education:
          'Retrieval practice and spaced repetition are associated with more durable memory, and forming new memories commonly involves the hippocampus.',
        regions: ['hippocampus', 'prefrontal'],
        confidence: buildConfidence({ sampleSize: sessions.length, unit: 'session', windowDays: 14 }),
      };
    },
  },
  {
    id: 'checkin_consistency',
    pillar: 'wellbeing',
    minSamples: 5,
    run(input, today) {
      const logs = lastNDays(input.checkins, today, 7);
      const days = uniqueSortedDates(logs);
      if (days.length < 5) return null;
      const mood = mean(logs.map((c: DailyCheckin) => c.mood));
      const energy = mean(logs.map((c) => c.energy));
      if (mood === null || energy === null) return null;
      return {
        id: 'checkin_consistency',
        pillar: 'wellbeing',
        kind: 'milestone',
        title: 'A week of checking in',
        body: `You checked in on ${days.length} of the last 7 days. Each check-in is a small moment of noticing how you are, and together they are building a picture of your own rhythms. Missing days are completely okay.`,
        evidence: [
          `Check-in days: ${days.length} of the last 7`,
          `Average mood: ${round1(mood)} of 5`,
          `Average energy: ${round1(energy)} of 5`,
        ],
        caveat:
          'Check-ins are self-reported snapshots of moments, not measurements of anything deeper. They are for you — not a report card.',
        confidence: buildConfidence({ sampleSize: days.length, unit: 'day', windowDays: 7 }),
      };
    },
  },
  {
    id: 'activity_variety',
    pillar: 'wellbeing',
    minSamples: 3,
    run(input, today) {
      const logs = lastNDays(input.activities ?? [], today, 7);
      if (logs.length < 3) return null;
      const types = [...new Set(logs.map((a) => a.type))].sort();
      if (types.length < 3) return null;
      const totalMin = logs.reduce((sum, a) => sum + a.durationMin, 0);
      const labels = types.map((t) => ACTIVITY_LABELS[t]).join(', ');
      return {
        id: 'activity_variety',
        pillar: 'wellbeing',
        kind: 'milestone',
        title: `You explored ${types.length} kinds of activities this week`,
        body: `Alongside everything else, you logged ${types.length} different kinds of non-study activities over the last 7 days: ${labels}. Making space for variety, curiosity and people belongs in a balanced week — just noticing, with zero targets to chase.`,
        evidence: [
          `Distinct activity types (last 7 days): ${types.length}`,
          `Types logged: ${labels}`,
          `Total logged time: ${fmtDur(totalMin)} across ${logs.length} logs`,
        ],
        caveat:
          'Counted from your self-reported activity logs over 7 days. Variety is a gentle observation, not a standard or measurement.',
        education:
          'Unfamiliar and varied experiences are commonly associated with prefrontal attention networks and hippocampal memory context.',
        regions: ['prefrontal', 'hippocampus'],
        confidence: buildConfidence({ sampleSize: logs.length, unit: 'entry', windowDays: 7 }),
      };
    },
  },
  {
    id: 'study_without_recovery',
    pillar: 'wellbeing',
    minSamples: 4,
    run(input, today) {
      const focusSessions = lastNDays(input.focus, today, 7);
      if (focusSessions.length < 4) return null;
      const focusMin = focusSessions.reduce((sum, s) => sum + s.durationMin, 0);
      if (focusMin < 120) return null;

      const activities = lastNDays(input.activities ?? [], today, 7);
      const mindfulness = lastNDays(input.mindfulness ?? [], today, 7);
      const movement = lastNDays(input.movement, today, 7);

      const hasSocialOrMindful =
        activities.some((a) => a.type === 'social') || mindfulness.length > 0;
      if (hasSocialOrMindful) return null;

      const recoveryMin =
        activities.reduce((sum, a) => sum + a.durationMin, 0) +
        mindfulness.reduce((sum, m) => sum + m.durationMin, 0) +
        movement.reduce((sum, m) => sum + m.durationMin, 0);

      if (recoveryMin > 0 && focusMin / (focusMin + recoveryMin) < 0.9) return null;

      return {
        id: 'study_without_recovery',
        pillar: 'wellbeing',
        kind: 'reflection',
        title: 'A very study-heavy week so far',
        body: `You logged ${focusSessions.length} focus sessions (${fmtDur(focusMin)}) in the last 7 days with little or no logged social, mindfulness, or unhurried break time. Full study weeks happen — especially around deadlines — and nothing here is a criticism. Whenever life leaves a small gap, even a quiet walk, a chat with a friend, or ten unhurried minutes away from screens can be a welcome counterweight.`,
        evidence: [
          `Focus sessions (last 7 days): ${focusSessions.length} (${fmtDur(focusMin)})`,
          `Logged social or mindfulness sessions: 0`,
          `Other logged movement/activity time: ${fmtDur(recoveryMin)}`,
        ],
        caveat:
          'Based only on what was self-reported in this browser — you may well have rested or seen friends without logging it.',
        education:
          'Time away from demanding tasks and supportive social contact are commonly associated with emotional regulation across prefrontal and amygdala networks.',
        regions: ['prefrontal', 'amygdala'],
        confidence: buildConfidence({ sampleSize: focusSessions.length, unit: 'session', windowDays: 7 }),
      };
    },
  },
  {
    id: 'reading_without_retrieval',
    pillar: 'learning',
    minSamples: 3,
    run(input, today) {
      const sessions = lastNDays(input.focus, today, 14);
      const deepReading = sessions.filter((s) => s.method === 'deep_reading');
      if (deepReading.length < 3) return null;

      const hasRetrieval = sessions.some(
        (s) => s.practicedRetrieval === true || s.method === 'active_recall',
      );
      if (hasRetrieval) return null;

      const readingMin = deepReading.reduce((sum, s) => sum + s.durationMin, 0);

      return {
        id: 'reading_without_retrieval',
        pillar: 'learning',
        kind: 'reflection',
        title: 'Mostly reading lately — room for a quick recall check?',
        body: `Over the last 14 days you logged ${deepReading.length} deep-reading sessions (${fmtDur(readingMin)}) without marking any retrieval practice. Re-reading feels smooth because familiar text is easy to recognize, which is a completely natural pull. Whenever it feels useful, closing your notes for two minutes and writing down what you remember is a gentle way to check what has settled.`,
        evidence: [
          `Deep-reading sessions (last 14 days): ${deepReading.length} (${fmtDur(readingMin)})`,
          'Sessions with retrieval practice: 0',
        ],
        caveat:
          'Based on self-reported focus sessions and retrieval toggles — you may have quizzed yourself informally without logging it.',
        education:
          'Retrieval practice (recalling ideas from memory rather than re-reading) is associated with more durable memory, which commonly involves the hippocampus and prefrontal cortex.',
        regions: ['hippocampus', 'prefrontal'],
        confidence: buildConfidence({ sampleSize: sessions.length, unit: 'session', windowDays: 14 }),
      };
    },
  },
  {
    id: 'session_length_vs_focus',
    pillar: 'focus',
    minSamples: 6,
    run(input, today) {
      const sessions = lastNDays(input.focus, today, 30);
      if (sessions.length < 6) return null;
      const durations = sessions.map((s) => s.durationMin);
      const ratings = sessions.map((s) => s.focusRating);
      const r = pearson(durations, ratings);
      if (r === null || Math.abs(r) < 0.3) return null;

      const shorter = sessions.filter((s) => s.durationMin <= 45).map((s) => s.focusRating);
      const longer = sessions.filter((s) => s.durationMin > 45).map((s) => s.focusRating);
      const avgShort = mean(shorter);
      const avgLong = mean(longer);

      const body =
        r > 0
          ? `Across ${sessions.length} sessions in the last 30 days, longer study blocks tended to coincide with higher self-rated focus. That often happens when you schedule longer blocks on days with more energy or lighter distractions — it is a correlation to notice, not a rule to chase.`
          : `Across ${sessions.length} sessions in the last 30 days, shorter study blocks tended to coincide with higher self-rated focus. Brief blocks can align with clearer boundaries or fresher attention, though topic difficulty and fatigue could explain the pattern just as easily.`;

      const evidence = [
        `Sessions examined: ${sessions.length} (last 30 days)`,
        `Pearson r = ${r.toFixed(2)} (duration vs. self-rated focus)`,
        `Session durations ranged from ${fmtDur(minOf(durations))} to ${fmtDur(maxOf(durations))}`,
      ];
      if (avgShort !== null && avgLong !== null) {
        evidence.push(`Mean focus: ${round1(avgShort)}/5 (<=45m) vs. ${round1(avgLong)}/5 (>45m)`);
      }

      return {
        id: 'session_length_vs_focus',
        pillar: 'focus',
        kind: 'observation',
        title:
          r > 0
            ? 'Longer sessions and higher focus ratings aligned lately'
            : 'Shorter sessions and steadier focus ratings aligned lately',
        body,
        evidence,
        caveat:
          'Correlation does not imply causation: self-reported focus can reflect energy, subject difficulty, or picking longer blocks when you already felt settled.',
        education:
          'Sustained attention commonly involves prefrontal and parietal networks, and comfortable session lengths differ from day to day.',
        regions: ['prefrontal', 'parietal'],
        confidence: buildConfidence({
          sampleSize: sessions.length,
          unit: 'session',
          paired: true,
          effectStrength: Math.abs(r),
        }),
      };
    },
  },
  {
    id: 'weekday_vs_weekend_pattern',
    pillar: 'sleep',
    minSamples: 6,
    run(input, today) {
      const nights = lastNDays(input.sleep, today, 21);
      if (nights.length < 6) return null;

      const weekdays: SleepLog[] = [];
      const weekends: SleepLog[] = [];
      for (const night of nights) {
        const dow = getDay(parseISO(night.date));
        if (dow === 0 || dow === 6) weekends.push(night);
        else weekdays.push(night);
      }
      if (weekdays.length < 4 || weekends.length < 2) return null;

      const wdDur = mean(weekdays.map((n) => n.durationMin));
      const weDur = mean(weekends.map((n) => n.durationMin));
      const wdBed = circularMeanMinutes(weekdays.map(bedtimeMinutes));
      const weBed = circularMeanMinutes(weekends.map(bedtimeMinutes));
      if (wdDur === null || weDur === null || wdBed === null || weBed === null) return null;

      const durDiff = weDur - wdDur;
      const bedDiff = signedClockDiffMin(weBed, wdBed);
      if (Math.abs(durDiff) < 30 && Math.abs(bedDiff) < 40) return null;

      const parts: string[] = [];
      if (Math.abs(bedDiff) >= 40) {
        parts.push(
          `bedtimes landed roughly ${fmtDur(Math.abs(bedDiff))} ${bedDiff > 0 ? 'later' : 'earlier'} on weekend mornings (${fmtClock(weBed)} vs. ${fmtClock(wdBed)})`,
        );
      }
      if (Math.abs(durDiff) >= 30) {
        parts.push(
          `nights ran about ${fmtDur(Math.abs(durDiff))} ${durDiff > 0 ? 'longer' : 'shorter'} on weekends (${fmtDur(weDur)} vs. ${fmtDur(wdDur)})`,
        );
      }

      return {
        id: 'weekday_vs_weekend_pattern',
        pillar: 'sleep',
        kind: 'observation',
        title: 'Weekday and weekend sleep patterns differ in your logs',
        body: `Over the last three weeks, ${parts.join(' and ')}. Schedules naturally flex between workdays and days off — this is simply a picture of how your calendar shapes your week.`,
        evidence: [
          `Nights compared: ${weekdays.length} weekday vs. ${weekends.length} weekend (last 21 days)`,
          `Weekday avg: ${fmtDur(wdDur)} · typical bedtime ${fmtClock(wdBed)}`,
          `Weekend avg: ${fmtDur(weDur)} · typical bedtime ${fmtClock(weBed)}`,
        ],
        caveat:
          'Self-reported wake dates and bedtimes over a small window. Weekend rhythms naturally shift with social plans, errands, and rest.',
        education:
          'Sleep timing shifts are associated with circadian rhythms, and sleep itself is associated with memory consolidation that commonly involves the hippocampus.',
        regions: ['hippocampus'],
        confidence: buildConfidence({
          sampleSize: nights.length,
          unit: 'night',
          paired: true,
          effectStrength: clamp(Math.max(Math.abs(durDiff) / 90, Math.abs(bedDiff) / 120), 0, 1),
        }),
      };
    },
  },
  {
    id: 'outdoor_time_mood_energy',
    pillar: 'wellbeing',
    minSamples: 6,
    run(input, today) {
      const checkins = lastNDays(input.checkins, today, 30).filter(
        (c): c is DailyCheckin & { outdoorMin: number } =>
          typeof c.outdoorMin === 'number' && Number.isFinite(c.outdoorMin),
      );
      if (checkins.length < 6) return null;

      const byDate = new Map<ISODate, DailyCheckin & { outdoorMin: number }>();
      for (const c of checkins) byDate.set(c.date, c);
      const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      if (days.length < 6) return null;

      const outdoors = days.map((d) => d.outdoorMin);
      const rMood = pearson(outdoors, days.map((d) => d.mood));
      const rEnergy = pearson(outdoors, days.map((d) => d.energy));

      let label: 'mood' | 'energy' | null = null;
      let rVal: number | null = null;
      if (rMood !== null && (rEnergy === null || Math.abs(rMood) >= Math.abs(rEnergy))) {
        label = 'mood';
        rVal = rMood;
      } else if (rEnergy !== null) {
        label = 'energy';
        rVal = rEnergy;
      }
      if (label === null || rVal === null || Math.abs(rVal) < 0.3) return null;

      const direction = rVal > 0 ? 'higher' : 'lower';
      return {
        id: 'outdoor_time_mood_energy',
        pillar: 'wellbeing',
        kind: 'observation',
        title: `Outdoor time and ${label} moved together lately`,
        body: `Across ${days.length} check-in days in the last 30 days, days with more logged outdoor minutes tended to coincide with ${direction} ${label} ratings. Weather, free time, and energy itself can easily pull both numbers together, so treat this as a descriptive snapshot rather than a cause.`,
        evidence: [
          `Matched check-in days: ${days.length} (last 30 days)`,
          `Pearson r = ${rVal.toFixed(2)} (outdoor minutes vs. ${label})`,
          `Logged outdoor time ranged from ${minOf(outdoors)}m to ${maxOf(outdoors)}m`,
        ],
        caveat:
          'Correlation is not causation: self-reported estimates over a modest sample can be shaped by daylight, schedule flexibility, and workload.',
        education:
          'Daylight and time outdoors are commonly associated with alertness and emotional regulation networks involving prefrontal regions.',
        regions: ['prefrontal'],
        confidence: buildConfidence({
          sampleSize: days.length,
          unit: 'day',
          paired: true,
          effectStrength: Math.abs(rVal),
        }),
      };
    },
  },
  {
    id: 'mindfulness_vs_stress',
    pillar: 'wellbeing',
    minSamples: 6,
    run(input, today) {
      const checkins = lastNDays(input.checkins, today, 30);
      const mindful = lastNDays(input.mindfulness ?? [], today, 30);
      if (checkins.length < 6 || mindful.length === 0) return null;

      const byDate = new Map<ISODate, DailyCheckin>();
      for (const c of checkins) byDate.set(c.date, c);
      const mindfulDates = new Set(mindful.map((m) => m.date));

      const withStress: number[] = [];
      const withoutStress: number[] = [];
      for (const [date, c] of byDate) {
        if (mindfulDates.has(date)) withStress.push(c.stress);
        else withoutStress.push(c.stress);
      }
      if (withStress.length < 3 || withoutStress.length < 3) return null;

      const avgWith = mean(withStress);
      const avgWithout = mean(withoutStress);
      if (avgWith === null || avgWithout === null) return null;

      const diff = avgWith - avgWithout;
      if (Math.abs(diff) < 0.4) return null;

      const totalDays = withStress.length + withoutStress.length;
      return {
        id: 'mindfulness_vs_stress',
        pillar: 'wellbeing',
        kind: 'observation',
        title:
          diff < 0
            ? 'Check-in stress tended to be lower on mindfulness days'
            : 'Mindfulness sessions showed up more often on fuller-stress days',
        body:
          diff < 0
            ? `Across ${totalDays} check-in days in the last 30 days, self-reported stress averaged ${round1(avgWith)}/5 on days when you logged breathing or meditation compared to ${round1(avgWithout)}/5 on other days. Calmer schedules may leave more room to pause, so this association does not tell us which led to which.`
            : `Across ${totalDays} check-in days in the last 30 days, self-reported stress averaged ${round1(avgWith)}/5 on days with breathing or meditation logs compared to ${round1(avgWithout)}/5 on other days. People often reach for a breathing session on tense days, which is a natural rhythm to notice.`,
        evidence: [
          `Days with mindfulness + check-in: ${withStress.length} (avg stress ${round1(avgWith)}/5)`,
          `Check-in days without mindfulness: ${withoutStress.length} (avg stress ${round1(avgWithout)}/5)`,
        ],
        caveat:
          'Self-reported ratings over a small window; schedule load and stressors can affect both stress ratings and when you pause to log a session. Not medical advice.',
        education:
          'Paced breathing and mindfulness practices are commonly associated with emotion-regulation circuits involving prefrontal and amygdala networks.',
        regions: ['prefrontal', 'amygdala'],
        confidence: buildConfidence({
          sampleSize: totalDays,
          unit: 'day',
          paired: true,
          effectStrength: clamp(Math.abs(diff) / 2, 0, 1),
        }),
      };
    },
  },
  {
    id: 'activity_variety_mood',
    pillar: 'wellbeing',
    minSamples: 6,
    run(input, today) {
      const checkins = lastNDays(input.checkins, today, 30);
      const activities = lastNDays(input.activities ?? [], today, 30);
      if (checkins.length < 6 || activities.length < 4) return null;

      const distinctOverall = new Set(activities.map((a) => a.type)).size;
      if (distinctOverall < 2) return null;

      const byDate = new Map<ISODate, DailyCheckin>();
      for (const c of checkins) byDate.set(c.date, c);
      const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      if (days.length < 6) return null;

      const activitiesByDate = groupByDate(activities);
      const varieties: number[] = [];
      const moods: number[] = [];

      for (const day of days) {
        const typesInWindow = new Set<PersonalActivityType>();
        for (let offset = 0; offset < 3; offset += 1) {
          const dKey = format(subDays(parseISO(day.date), offset), 'yyyy-MM-dd');
          for (const entry of activitiesByDate.get(dKey) ?? []) {
            typesInWindow.add(entry.type);
          }
        }
        varieties.push(typesInWindow.size);
        moods.push(day.mood);
      }

      const r = pearson(varieties, moods);
      if (r === null || Math.abs(r) < 0.3) return null;

      const higherVarietyMoods = moods.filter((_, i) => (varieties[i] ?? 0) >= 2);
      const lowerVarietyMoods = moods.filter((_, i) => (varieties[i] ?? 0) < 2);
      const avgHigh = mean(higherVarietyMoods);
      const avgLow = mean(lowerVarietyMoods);

      const evidence = [
        `Check-in days analyzed: ${days.length} (last 30 days)`,
        `Activity types logged across period: ${distinctOverall}`,
        `Pearson r = ${r.toFixed(2)} (3-day activity variety vs. mood)`,
      ];
      if (avgHigh !== null && avgLow !== null) {
        evidence.push(`Mean mood: ${round1(avgHigh)}/5 (2+ recent types) vs. ${round1(avgLow)}/5 (<2 types)`);
      }

      return {
        id: 'activity_variety_mood',
        pillar: 'wellbeing',
        kind: 'observation',
        title:
          r > 0
            ? 'Varied personal activities and mood aligned in your logs'
            : 'Activity variety and mood moved inversely lately',
        body:
          r > 0
            ? `Over the last 30 days, check-in days paired with more varied non-study activities tended to coincide with higher self-reported mood ratings. Having free time or steady energy can invite both variety and a lighter mood, so this stays a descriptive clue rather than a rule.`
            : `Over the last 30 days, check-in days paired with more varied activities tended to coincide with slightly lower mood ratings — small-sample noise or reaching for hobbies on harder days can easily produce that pattern.`,
        evidence,
        caveat:
          'Correlation does not imply causation: both self-reported mood and non-study activities are shaped by free time, workload, and life events.',
        education:
          'Varied and novel personal experiences are commonly associated with prefrontal attention networks and hippocampal memory context.',
        regions: ['prefrontal', 'hippocampus'],
        confidence: buildConfidence({
          sampleSize: days.length,
          unit: 'day',
          paired: true,
          effectStrength: Math.abs(r),
        }),
      };
    },
  },
  {
    id: 'sleep_consistency_long_window',
    pillar: 'sleep',
    minSamples: 14,
    dedupeGroup: 'sleep_timing',
    run(input, today) {
      const nights = lastNDays(input.sleep, today, 28);
      if (nights.length < 14) return null;

      const bedtimes = nights.map(bedtimeMinutes);
      const spread = circularStdMinutes(bedtimes);
      const center = circularMeanMinutes(bedtimes);
      const avgDur = mean(nights.map((n) => n.durationMin));
      if (spread === null || center === null || avgDur === null) return null;

      if (spread <= 45) {
        return {
          id: 'sleep_consistency_long_window',
          pillar: 'sleep',
          kind: 'milestone',
          title: 'A steady bedtime rhythm across the month',
          body: `Across ${nights.length} logged nights over the last 28 days, your bedtimes stayed within about ${fmtDur(spread)} of ${fmtClock(center)}. That kind of steadiness takes shape around real-world routines without needing rigid rules.`,
          evidence: [
            `Nights logged (last 28 days): ${nights.length}`,
            `Typical bedtime: about ${fmtClock(center)}`,
            `Circular bedtime variation: about ${Math.round(spread)} min`,
            `Average duration: ${fmtDur(avgDur)}`,
          ],
          caveat:
            'Derived from self-reported bedtimes over 28 days. Steady timing is simply a description of your routine, not a metric or requirement.',
          education:
            'Steady sleep timing is associated with aligned circadian rhythms; sleep is associated with memory consolidation involving the hippocampus.',
          regions: ['hippocampus'],
          confidence: buildConfidence({ sampleSize: nights.length, unit: 'night', windowDays: 28 }),
        };
      }

      if (spread > 65) {
        return {
          id: 'sleep_consistency_long_window',
          pillar: 'sleep',
          kind: 'observation',
          title: 'Bedtimes varied across the last month',
          body: `Over ${nights.length} logged nights in the last 28 days, your bedtimes varied by roughly ${fmtDur(spread)} around ${fmtClock(center)}. Multi-week schedules shift for plenty of reasons — deadlines, travel, or late evenings — so this is just a calm look at the longer arc.`,
          evidence: [
            `Nights logged (last 28 days): ${nights.length}`,
            `Typical bedtime: about ${fmtClock(center)}`,
            `Circular bedtime variation: about ${Math.round(spread)} min`,
          ],
          caveat:
            'Self-reported bedtimes over a 28-day window. Timing spread is descriptive only and is not linked to any verdict here.',
          education:
            'Regular sleep timing is associated with steadier circadian rhythms, and sleep is associated with memory consolidation involving the hippocampus.',
          regions: ['hippocampus'],
          confidence: buildConfidence({ sampleSize: nights.length, unit: 'night', windowDays: 28 }),
        };
      }

      return null;
    },
  },
  // v0.4 planner rules are appended so every pre-v0.4 ordering assertion holds.
  ...PLANNER_RULES,
];
