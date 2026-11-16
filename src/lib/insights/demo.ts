import type {
  DailyCheckin, FocusSession, Habit, HabitLog, InsightInput, ISODate,
  LearningMethod, MovementLog, NutritionLog, Rating, SleepLog, UserSettings,
} from '@/types/domain';
import { addMinutes, format, getDay, startOfDay, subDays } from 'date-fns';
import { clamp } from './stats';

/** Mulberry32: tiny, fast, deterministic 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METHODS: readonly LearningMethod[] = [
  'active_recall', 'spaced_repetition', 'problem_solving', 'deep_reading', 'skill_practice', 'teaching',
];
const SUBJECTS = ['Math', 'Reading', 'Code', 'Language', 'Music', 'Writing'] as const;
const MOVEMENT_TYPES: readonly MovementLog['type'][] = ['walk', 'run', 'cycle', 'gym', 'stretch', 'sport'];
const SESSION_DURATIONS = [25, 30, 45, 50, 60, 90] as const;

const HABIT_DEFS: readonly { name: string; icon: string }[] = [
  { name: 'Read 10 pages', icon: '📖' },
  { name: 'Morning stretch', icon: '🤸' },
  { name: 'Walk outside', icon: '🚶' },
  { name: 'Evening journal', icon: '✍️' },
];

const toRating = (x: number): Rating => clamp(Math.round(x), 1, 5) as Rating;
const wrapDay = (m: number): number => ((m % 1440) + 1440) % 1440;

/**
 * Deterministic demo dataset ending on `today` (calendar day; time-of-day is normalized away).
 * Same (days, seed, calendar day) → identical output, including ids and timestamps.
 * Concentration is mildly correlated (r ≈ 0.4) with the sleep that ended that morning.
 */
export function generateDemoData(days: number, seed: number, today: Date = new Date()): InsightInput {
  const rand = mulberry32(seed);
  const gaussian = (): number => {
    const u1 = Math.max(rand(), 1e-12); // Box–Muller; guard log(0)
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const pick = <T>(arr: readonly T[]): T => {
    const idx = Math.min(arr.length - 1, Math.floor(rand() * arr.length));
    const value = arr[idx];
    if (value === undefined) throw new Error('pick from empty array');
    return value;
  };

  const totalDays = Math.max(0, Math.floor(days));
  const end = startOfDay(today);
  const todayISO = format(end, 'yyyy-MM-dd');

  const settings: UserSettings = {
    id: 'demo-settings', createdAt: `${todayISO}T08:00:00`, updatedAt: `${todayISO}T08:00:00`,
    displayName: 'Demo', sleepTargetMin: 480, focusDefaultMin: 25, breakDefaultMin: 5,
    onboarded: true, schemaVersion: 1,
  };
  const habits: Habit[] = HABIT_DEFS.map((h, i) => ({
    id: `demo-habit-${i + 1}`, createdAt: `${todayISO}T08:00:00`, updatedAt: `${todayISO}T08:00:00`,
    name: h.name, icon: h.icon, archived: false,
  }));

  const sleep: SleepLog[] = [];
  const checkins: DailyCheckin[] = [];
  const focus: FocusSession[] = [];
  const movement: MovementLog[] = [];
  const nutrition: NutritionLog[] = [];
  const habitLogs: HabitLog[] = [];

  // Fixed call order for rand() → determinism. Oldest day first, so arrays are chronological.
  for (let k = totalDays - 1; k >= 0; k--) {
    const dateObj = subDays(end, k);
    const date: ISODate = format(dateObj, 'yyyy-MM-dd');
    const dow = getDay(dateObj);
    const weekend = dow === 0 || dow === 6; // wake-up date on Sat/Sun: sleep-in + later bedtime

    // --- sleep (every day): N(7.2h, 0.9h), weekend drift, clamped to 5–10h ---
    const zSleep = gaussian();
    const durationMin = Math.round(clamp(432 + 54 * zSleep + (weekend ? 20 : 0), 300, 600));
    const bedNoise = gaussian();
    const bedMin = wrapDay(Math.round(1395 + 35 * bedNoise + (weekend ? 45 : 0))); // ~23:15 base
    // bedMin is always evening (>21:00) or early night (<03:00), so wake lands on `date`.
    const bedBase = bedMin >= 720 ? startOfDay(subDays(dateObj, 1)) : dateObj;
    const bedDate = addMinutes(bedBase, bedMin);
    const wakeDate = addMinutes(bedDate, durationMin);
    const bedtime = format(bedDate, "yyyy-MM-dd'T'HH:mm:ss");
    const wakeTime = format(wakeDate, "yyyy-MM-dd'T'HH:mm:ss");
    const quality = toRating(3 + (durationMin - 432) / 90 + (rand() - 0.5));
    const rested = toRating(3 + (durationMin - 432) / 90 + (rand() - 0.5));
    const interruptions = rand() < 0.7 ? 0 : rand() < 0.8 ? 1 : 2;
    sleep.push({ id: `demo-sleep-${date}`, createdAt: wakeTime, updatedAt: wakeTime, date, bedtime, wakeTime, durationMin, quality, rested, interruptions });

    // --- check-in (~85%): concentration shares 0.45 of its variance with zSleep ---
    if (rand() < 0.85) {
      const zc = gaussian();
      const concentration = toRating(3 + 0.45 * zSleep + 0.893 * zc);
      const mood = toRating(3 + 0.3 * zSleep + 0.9 * gaussian());
      const stress = toRating(3 - 0.25 * zSleep + 0.9 * gaussian());
      const energy = toRating(3 + 0.35 * zSleep + 0.9 * gaussian());
      const motivation = toRating(3 + 0.9 * gaussian());
      const outdoorMin = Math.round(rand() * 70);
      const at = `${date}T21:00:00`;
      checkins.push({ id: `demo-checkin-${date}`, createdAt: at, updatedAt: at, date, mood, stress, energy, concentration, motivation, outdoorMin });
    }

    // --- focus sessions (~70% of days, 1–2 per day) ---
    if (rand() < 0.7) {
      const nSessions = rand() < 0.3 ? 2 : 1;
      for (let i = 0; i < nSessions; i++) {
        const dur = pick(SESSION_DURATIONS);
        const method = pick(METHODS);
        const subject = pick(SUBJECTS);
        const focusRating = toRating(3 + 0.5 * zSleep + 0.8 * gaussian());
        const difficulty = (2 + Math.floor(rand() * 3)) as Rating;
        const distractions = Math.floor(rand() * (dur > 60 ? 4 : 3));
        const startedAt = `${date}T${i === 0 ? '09' : '16'}:00:00`;
        focus.push({ id: `demo-focus-${date}-${i + 1}`, createdAt: startedAt, updatedAt: startedAt, date, startedAt, durationMin: dur, plannedMin: dur, subject, method, focusRating, difficulty, distractions });
      }
    }

    // --- movement (~4 days/week) ---
    if (rand() < 4 / 7) {
      const type = pick(MOVEMENT_TYPES);
      const minutes = 20 + Math.floor(rand() * 41);
      const effort = (2 + Math.floor(rand() * 3)) as Rating;
      const at = `${date}T18:00:00`;
      movement.push({ id: `demo-movement-${date}`, createdAt: at, updatedAt: at, date, type, durationMin: minutes, effort });
    }

    // --- nutrition (~70%) ---
    if (rand() < 0.7) {
      const regularMeals = rand() < 0.75;
      const fruitVeg = rand() < 0.7;
      const varied = rand() < 0.65;
      const waterGlasses = 4 + Math.floor(rand() * 6);
      const at = `${date}T20:00:00`;
      nutrition.push({ id: `demo-nutrition-${date}`, createdAt: at, updatedAt: at, date, regularMeals, fruitVeg, varied, waterGlasses });
    }

    // --- habits: a done-log on ~60% of days per habit ---
    for (let h = 0; h < habits.length; h++) {
      if (rand() < 0.6) {
        const habit = habits[h];
        if (habit === undefined) continue;
        const at = `${date}T21:30:00`;
        habitLogs.push({ id: `demo-habitlog-${h + 1}-${date}`, createdAt: at, updatedAt: at, date, habitId: habit.id, done: true });
      }
    }
  }

  return { settings, sleep, checkins, focus, movement, nutrition, habits, habitLogs };
}
