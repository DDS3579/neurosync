import { format, startOfDay, subDays } from "date-fns";

import { activityToRegionIntensity } from "@/data/brainRegions";
import { SCHEMA_VERSION, importAll } from "@/lib/db/backup";
import {
  checkinRepository,
  focusRepository,
  habitLogRepository,
  habitRepository,
  movementRepository,
  nutritionRepository,
  settingsRepository,
  sleepRepository,
} from "@/lib/db/repositories";
import { computeInsights, generateDemoData } from "@/lib/insights";
import type { OverviewViewProps } from "@/features/overview/OverviewView";
import type {
  ActivityKind,
  DailyCheckin,
  FocusSession,
  Habit,
  HabitLog,
  ISODate,
  LearningMethod,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  SleepLog,
  UserSettings,
} from "@/types/domain";

const DEMO_PREFIX = "demo-";
const DEMO_DAYS = 14;
const DEMO_SEED = 42;

const METHOD_TO_ACTIVITY: Record<LearningMethod, ActivityKind> = {
  active_recall: "active_recall",
  spaced_repetition: "spaced_repetition",
  problem_solving: "problem_solving",
  deep_reading: "reading",
  skill_practice: "skill_practice",
  teaching: "teaching",
};

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_PREFIX);
}

export async function loadDemoDataToDb(today: Date = new Date()): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await settingsRepository.ensure();
  const demo = generateDemoData(DEMO_DAYS, DEMO_SEED, today);

  await importAll(
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tables: {
        settings: [],
        sleepLogs: demo.sleep,
        checkins: demo.checkins,
        focusSessions: demo.focus,
        movementLogs: demo.movement,
        nutritionLogs: demo.nutrition,
        habits: demo.habits,
        habitLogs: demo.habitLogs,
        experiments: [],
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
      },
    }),
    "merge",
  );
}

export async function clearDemoDataFromDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const repos = [
    sleepRepository,
    checkinRepository,
    focusRepository,
    movementRepository,
    nutritionRepository,
    habitRepository,
    habitLogRepository,
  ] as const;

  await Promise.all(
    repos.map(async (repo) => {
      const rows = await repo.listAll();
      const demoRows = rows.filter((row) => isDemoId(row.id));
      await Promise.all(demoRows.map((row) => repo.remove(row.id)));
    }),
  );
}

export interface OverviewAggregationInput {
  settings: UserSettings;
  sleep: SleepLog[];
  checkins: DailyCheckin[];
  focus: FocusSession[];
  movement: MovementLog[];
  nutrition: NutritionLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  mindfulness?: MindfulnessSession[];
  today?: Date;
}

export function buildOverviewViewData(input: OverviewAggregationInput): Omit<
  OverviewViewProps,
  "onLogToday" | "onLoadDemo" | "onClearDemo" | "onOpenBrain"
> & { hasDemoData: boolean } {
  const todayDate = startOfDay(input.today ?? new Date());
  const todayISO: ISODate = format(todayDate, "yyyy-MM-dd");

  const dates7: ISODate[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    dates7.push(format(subDays(todayDate, offset), "yyyy-MM-dd"));
  }
  const weekStartISO = dates7[0] ?? todayISO;

  const sleepByDate = new Map<ISODate, SleepLog>();
  for (const row of input.sleep) {
    sleepByDate.set(row.date, row);
  }

  const checkinByDate = new Map<ISODate, DailyCheckin>();
  for (const row of input.checkins) {
    checkinByDate.set(row.date, row);
  }

  const focusMinutesByDate = new Map<ISODate, number>();
  for (const row of input.focus) {
    focusMinutesByDate.set(row.date, (focusMinutesByDate.get(row.date) ?? 0) + row.durationMin);
  }

  const todayFocus = input.focus.filter((row) => row.date === todayISO);
  const todayMovement = input.movement.filter((row) => row.date === todayISO);
  const todayMindfulness = (input.mindfulness ?? []).filter((row) => row.date === todayISO);
  const todaySleep = sleepByDate.get(todayISO);

  const activityItems: { kind: ActivityKind; minutes: number }[] = [];
  for (const s of todayFocus) {
    activityItems.push({ kind: METHOD_TO_ACTIVITY[s.method], minutes: s.durationMin });
  }
  for (const m of todayMovement) {
    activityItems.push({ kind: "exercise", minutes: m.durationMin });
  }
  for (const ms of todayMindfulness) {
    activityItems.push({ kind: "mindfulness", minutes: ms.durationMin });
  }
  if (todaySleep) {
    activityItems.push({ kind: "sleep_rest", minutes: Math.min(120, Math.round(todaySleep.durationMin / 4)) });
  }

  const weekMovementDays = new Set(
    input.movement
      .filter((row) => row.date >= weekStartISO && row.date <= todayISO)
      .map((row) => row.date),
  ).size;

  const insights = computeInsights(
    {
      settings: input.settings,
      sleep: input.sleep,
      checkins: input.checkins,
      focus: input.focus,
      movement: input.movement,
      nutrition: input.nutrition,
      habits: input.habits,
      habitLogs: input.habitLogs,
    },
    todayISO,
  ).slice(0, 3);

  const isEmpty =
    input.sleep.length === 0 &&
    input.checkins.length === 0 &&
    input.focus.length === 0 &&
    input.movement.length === 0 &&
    input.nutrition.length === 0 &&
    input.habitLogs.length === 0;

  const hasDemoData =
    input.sleep.some((r) => isDemoId(r.id)) ||
    input.checkins.some((r) => isDemoId(r.id)) ||
    input.focus.some((r) => isDemoId(r.id)) ||
    input.movement.some((r) => isDemoId(r.id)) ||
    input.nutrition.some((r) => isDemoId(r.id)) ||
    input.habits.some((r) => isDemoId(r.id)) ||
    input.habitLogs.some((r) => isDemoId(r.id));

  return {
    greetingName: input.settings.displayName?.trim() || undefined,
    today: {
      checkinDone: checkinByDate.has(todayISO),
      sleepLogged: sleepByDate.has(todayISO),
      focusMinutes: focusMinutesByDate.get(todayISO) ?? 0,
      movementMinutes: todayMovement.reduce((sum, m) => sum + m.durationMin, 0),
    },
    sleepWeek: dates7.map((date) => {
      const log = sleepByDate.get(date);
      return { date, hours: log ? Number((log.durationMin / 60).toFixed(2)) : null };
    }),
    sleepTargetHours: Number((input.settings.sleepTargetMin / 60).toFixed(2)),
    focusWeek: dates7.map((date) => ({
      date,
      minutes: focusMinutesByDate.get(date) ?? 0,
    })),
    moodWeek: dates7.map((date) => {
      const c = checkinByDate.get(date);
      return {
        date,
        mood: c ? c.mood : null,
        concentration: c ? c.concentration : null,
      };
    }),
    movementWeekDays: weekMovementDays,
    insights,
    brainActivity: activityToRegionIntensity(activityItems),
    isEmpty,
    hasDemoData,
  };
}
