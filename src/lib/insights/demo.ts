import { DEFAULT_SETTINGS_INPUT } from "@/lib/db/repositories";
import { SCHEMA_VERSION, SETTINGS_ID } from "@/lib/db/dexie";
import type {
  DailyCheckin,
  FocusSession,
  Habit,
  HabitLog,
  InsightInput,
  ISODate,
  LearningMethod,
  MovementLog,
  NutritionLog,
  Rating,
  SleepLog,
  UserSettings,
} from "@/types/domain";

/** Deterministic PRNG so the same seed always produces the same demo set. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[], fallback: T): T {
  if (values.length === 0) return fallback;
  const index = Math.floor(random() * values.length);
  return values[index] ?? fallback;
}

function ratingFrom(random: () => number, low: number, high: number): Rating {
  const value = Math.round(low + random() * (high - low));
  return Math.min(5, Math.max(1, value)) as Rating;
}

function isoDay(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** TODO(stub): replaced by the shared demo generator used by onboarding. */
export function generateDemoData(days: number, seed: number): InsightInput {
  const random = mulberry32(seed);
  const total = Math.max(1, Math.floor(days));
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const settings: UserSettings = {
    ...DEFAULT_SETTINGS_INPUT,
    id: SETTINGS_ID,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };

  const sleep: SleepLog[] = [];
  const checkins: DailyCheckin[] = [];
  const focus: FocusSession[] = [];
  const movement: MovementLog[] = [];
  const nutrition: NutritionLog[] = [];

  const methods: LearningMethod[] = [
    "active_recall",
    "spaced_repetition",
    "problem_solving",
    "deep_reading",
    "skill_practice",
    "teaching",
  ];
  const movementTypes: MovementLog["type"][] = [
    "walk",
    "run",
    "cycle",
    "sport",
    "gym",
    "stretch",
    "other",
  ];

  for (let offset = total - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    const date = isoDay(day);
    const timestamp = `${date}T20:00:00.000Z`;
    const sleepDuration = 360 + Math.round(random() * 120);

    sleep.push({
      id: `demo-sleep-${date}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      date,
      bedtime: `${date}T23:15:00.000Z`,
      wakeTime: `${date}T07:00:00.000Z`,
      durationMin: sleepDuration,
      quality: ratingFrom(random, 2, 5),
      rested: ratingFrom(random, 2, 5),
      interruptions: Math.floor(random() * 3),
    });

    checkins.push({
      id: `demo-checkin-${date}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      date,
      mood: ratingFrom(random, 2, 5),
      stress: ratingFrom(random, 1, 4),
      energy: ratingFrom(random, 2, 5),
      concentration: ratingFrom(random, 2, 5),
      motivation: ratingFrom(random, 2, 5),
      outdoorMin: Math.round(random() * 60),
    });

    if (random() > 0.25) {
      focus.push({
        id: `demo-focus-${date}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        date,
        startedAt: `${date}T09:00:00.000Z`,
        durationMin: 20 + Math.round(random() * 40),
        plannedMin: 25,
        subject: pick(random, ["Reading", "Problem sets", "Language", "Writing"], "Reading"),
        method: pick(random, methods, "active_recall"),
        focusRating: ratingFrom(random, 2, 5),
        difficulty: ratingFrom(random, 1, 4),
        distractions: Math.floor(random() * 3),
      });
    }

    if (random() > 0.35) {
      movement.push({
        id: `demo-movement-${date}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        date,
        type: pick(random, movementTypes, "walk"),
        durationMin: 15 + Math.round(random() * 45),
        effort: ratingFrom(random, 1, 4),
      });
    }

    if (random() > 0.3) {
      nutrition.push({
        id: `demo-nutrition-${date}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        date,
        regularMeals: random() > 0.3,
        fruitVeg: random() > 0.35,
        varied: random() > 0.4,
        waterGlasses: 3 + Math.floor(random() * 5),
      });
    }
  }

  const habits: Habit[] = ["Evening walk", "Read 20 minutes", "Phone away at 22:00"].map(
    (name, index) => ({
      id: `demo-habit-${index}`,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      name,
      archived: false,
    }),
  );

  const habitLogs: HabitLog[] = [];

  for (const habit of habits) {
    for (const log of sleep) {
      if (random() > 0.4) {
        habitLogs.push({
          id: `demo-habitlog-${habit.id}-${log.date}`,
          createdAt: `${log.date}T20:00:00.000Z`,
          updatedAt: `${log.date}T20:00:00.000Z`,
          date: log.date,
          habitId: habit.id,
          done: random() > 0.35,
        });
      }
    }
  }

  return { settings, sleep, checkins, focus, movement, nutrition, habits, habitLogs };
}
