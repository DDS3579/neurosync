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
import { format, parseISO, subDays } from 'date-fns';
import {
  circularMeanMinutes,
  circularStdMinutes,
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
      };
    },
  },
  {
    id: 'bedtime_irregular',
    pillar: 'sleep',
    minSamples: 5,
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
      };
    },
  },
];
