import { format, startOfDay, subDays } from "date-fns";

import { activityToRegionIntensity } from "@/data/brainRegions";
import { SCHEMA_VERSION, importAll } from "@/lib/db/backup";
import {
  activityRepository,
  blockRepository,
  checkinRepository,
  dayPlanMetaRepository,
  focusRepository,
  gratitudeRepository,
  habitLogRepository,
  habitRepository,
  journalRepository,
  mindfulnessRepository,
  movementRepository,
  nutritionRepository,
  projectRepository,
  reviewRepository,
  settingsRepository,
  sleepRepository,
  taskRepository,
} from "@/lib/db/repositories";
import { computeInsights, generateDemoData, selectOverviewInsights } from "@/lib/insights";
import type { OverviewViewProps } from "@/features/overview/OverviewView";
import type {
  ActivityKind,
  ActivityLog,
  Block,
  DailyCheckin,
  DayPlanMeta,
  FocusSession,
  Habit,
  HabitLog,
  InsightFeedback,
  ISODate,
  LearningMethod,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  Project,
  SleepLog,
  Task,
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
  const end = startOfDay(today);
  const day = (offset: number): ISODate => format(subDays(end, offset), "yyyy-MM-dd");
  const stamp = (offset: number, hhmm = "19:30:00"): string => `${day(offset)}T${hhmm}`;

  const mindfulnessSessions: MindfulnessSession[] = [
    {
      id: "demo-mind-1",
      date: day(0),
      type: "box_breathing",
      durationMin: 4,
      createdAt: stamp(0, "08:30:00"),
      updatedAt: stamp(0, "08:30:00"),
    },
    {
      id: "demo-mind-2",
      date: day(2),
      type: "meditation",
      durationMin: 10,
      createdAt: stamp(2, "21:15:00"),
      updatedAt: stamp(2, "21:15:00"),
    },
    {
      id: "demo-mind-3",
      date: day(4),
      type: "4_7_8_breathing",
      durationMin: 3,
      createdAt: stamp(4, "22:00:00"),
      updatedAt: stamp(4, "22:00:00"),
    },
    {
      id: "demo-mind-4",
      date: day(6),
      type: "box_breathing",
      durationMin: 5,
      createdAt: stamp(6, "13:00:00"),
      updatedAt: stamp(6, "13:00:00"),
    },
  ];

  const journalEntries = [
    {
      id: "demo-journal-1",
      date: day(0),
      text: "Felt noticeably steadier after stepping outside for 20 minutes before afternoon reading.",
      createdAt: stamp(0, "20:00:00"),
      updatedAt: stamp(0, "20:00:00"),
    },
    {
      id: "demo-journal-2",
      date: day(2),
      text: "Switching to short self-testing questions helped show what actually needed a second pass.",
      createdAt: stamp(2, "20:30:00"),
      updatedAt: stamp(2, "20:30:00"),
    },
  ];

  const gratitudeEntries = [
    {
      id: "demo-grat-1",
      date: day(0),
      items: ["Afternoon tea break without screens", "Clear walk before dusk"],
      createdAt: stamp(0, "21:10:00"),
      updatedAt: stamp(0, "21:10:00"),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: "demo-act-1",
      date: day(0),
      type: "social",
      durationMin: 45,
      enjoyment: 5,
      note: "Coffee catch-up after study block",
      createdAt: stamp(0, "17:00:00"),
      updatedAt: stamp(0, "17:00:00"),
    },
    {
      id: "demo-act-2",
      date: day(1),
      type: "creative",
      durationMin: 35,
      enjoyment: 4,
      note: "Sketchbook warm-up",
      createdAt: stamp(1, "19:00:00"),
      updatedAt: stamp(1, "19:00:00"),
    },
    {
      id: "demo-act-3",
      date: day(3),
      type: "music",
      durationMin: 30,
      enjoyment: 5,
      note: "Acoustic fingerpicking practice",
      createdAt: stamp(3, "18:30:00"),
      updatedAt: stamp(3, "18:30:00"),
    },
    {
      id: "demo-act-4",
      date: day(5),
      type: "novelty",
      durationMin: 40,
      enjoyment: 4,
      note: "Walked a new park loop without headphones",
      createdAt: stamp(5, "16:45:00"),
      updatedAt: stamp(5, "16:45:00"),
    },
  ];

  const reviewItems = [
    {
      id: "demo-review-1",
      topic: "Hippocampal memory consolidation",
      intervalStep: 1,
      nextReviewDate: day(0),
      lastReviewedDate: day(3),
      reviewCount: 1,
      createdAt: stamp(4, "10:00:00"),
      updatedAt: stamp(3, "10:00:00"),
    },
    {
      id: "demo-review-2",
      topic: "Prefrontal working-memory gating",
      intervalStep: 0,
      nextReviewDate: day(0),
      lastReviewedDate: day(1),
      reviewCount: 1,
      createdAt: stamp(2, "10:00:00"),
      updatedAt: stamp(1, "10:00:00"),
    },
  ];

  const projects: Project[] = [
    {
      id: "demo-proj-1",
      name: "Cognitive Neuro",
      color: "#8B5CF6",
      archived: false,
      createdAt: stamp(7, "08:00:00"),
      updatedAt: stamp(7, "08:00:00"),
    },
    {
      id: "demo-proj-2",
      name: "Daily Ops",
      color: "#22D3EE",
      archived: false,
      createdAt: stamp(7, "08:05:00"),
      updatedAt: stamp(7, "08:05:00"),
    },
  ];

  const tasks: Task[] = [
    {
      id: "demo-task-1",
      title: "Prefrontal executive-control notes",
      projectId: "demo-proj-1",
      notes: "Summarize retrieval cues in own words.",
      kind: "deep",
      estimateMin: 100,
      dueDate: day(0),
      status: "active",
      createdAt: stamp(2, "09:00:00"),
      updatedAt: stamp(0, "08:00:00"),
    },
    {
      id: "demo-task-2",
      title: "Spaced-repetition card batch",
      projectId: "demo-proj-2",
      kind: "shallow",
      estimateMin: 30,
      dueDate: day(0),
      status: "active",
      repeatWeekdays: [1, 3, 5],
      createdAt: stamp(3, "09:00:00"),
      updatedAt: stamp(0, "08:05:00"),
    },
    {
      id: "demo-task-3",
      title: "Afternoon walk without headphones",
      kind: "recovery",
      estimateMin: 30,
      dueDate: day(0),
      status: "active",
      createdAt: stamp(1, "09:00:00"),
      updatedAt: stamp(0, "08:10:00"),
    },
    {
      id: "demo-task-4",
      title: "Weekly reading inbox triage",
      projectId: "demo-proj-2",
      kind: "shallow",
      estimateMin: 40,
      dueDate: day(1),
      status: "done",
      createdAt: stamp(2, "10:00:00"),
      updatedAt: stamp(1, "14:40:00"),
    },
  ];

  const blocks: Block[] = [
    {
      id: "demo-blk-1",
      taskId: "demo-task-1",
      order: 0,
      plannedMin: 50,
      status: "scheduled",
      plannedDate: day(0),
      plannedStart: "09:00",
      createdAt: stamp(2, "09:00:00"),
      updatedAt: stamp(0, "08:00:00"),
    },
    {
      id: "demo-blk-2",
      taskId: "demo-task-1",
      order: 1,
      plannedMin: 50,
      status: "todo",
      createdAt: stamp(2, "09:01:00"),
      updatedAt: stamp(2, "09:01:00"),
    },
    {
      id: "demo-blk-3",
      taskId: "demo-task-2",
      order: 1,
      plannedMin: 30,
      status: "todo",
      plannedDate: day(0),
      createdAt: stamp(0, "08:05:00"),
      updatedAt: stamp(0, "08:05:00"),
    },
    {
      id: "demo-blk-4",
      taskId: "demo-task-3",
      order: 2,
      plannedMin: 30,
      status: "scheduled",
      plannedDate: day(0),
      plannedStart: "16:30",
      createdAt: stamp(0, "08:10:00"),
      updatedAt: stamp(0, "08:10:00"),
    },
    {
      id: "demo-blk-5",
      taskId: "demo-task-4",
      order: 0,
      plannedMin: 40,
      status: "done",
      plannedDate: day(1),
      plannedStart: "14:00",
      actualMin: 35,
      completedAt: stamp(1, "14:35:00"),
      createdAt: stamp(1, "08:00:00"),
      updatedAt: stamp(1, "14:35:00"),
    },
  ];

  const dayPlanMeta: DayPlanMeta[] = [
    {
      id: "demo-meta-1",
      date: day(1),
      shutdownDone: true,
      reflection: "Wrapped shallow reading triage before evening wind-down.",
      createdAt: stamp(1, "21:15:00"),
      updatedAt: stamp(1, "21:15:00"),
    },
  ];

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
        mindfulnessSessions,
        journalEntries,
        gratitudeEntries,
        activityLogs,
        reviewItems,
        dayPlans: [],
        insightFeedback: [],
        microtaskResults: [],
        projects,
        tasks,
        blocks,
        dayPlanMeta,
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
    mindfulnessRepository,
    journalRepository,
    gratitudeRepository,
    activityRepository,
    reviewRepository,
    blockRepository,
    taskRepository,
    projectRepository,
    dayPlanMetaRepository,
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
  activities?: ActivityLog[];
  insightFeedback?: InsightFeedback[];
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
  const todayActivities = (input.activities ?? []).filter((row) => row.date === todayISO);
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
  for (const act of todayActivities) {
    activityItems.push({ kind: act.type, minutes: act.durationMin });
  }
  if (todaySleep) {
    activityItems.push({ kind: "sleep_rest", minutes: Math.min(120, Math.round(todaySleep.durationMin / 4)) });
  }

  const weekMovementDays = new Set(
    input.movement
      .filter((row) => row.date >= weekStartISO && row.date <= todayISO)
      .map((row) => row.date),
  ).size;

  const allInsights = computeInsights(
    {
      settings: input.settings,
      sleep: input.sleep,
      checkins: input.checkins,
      focus: input.focus,
      movement: input.movement,
      nutrition: input.nutrition,
      habits: input.habits,
      habitLogs: input.habitLogs,
      activities: input.activities,
      mindfulness: input.mindfulness,
    },
    todayISO,
    { feedback: input.insightFeedback },
  );
  const insights = selectOverviewInsights(allInsights, 3);

  const isEmpty =
    input.sleep.length === 0 &&
    input.checkins.length === 0 &&
    input.focus.length === 0 &&
    input.movement.length === 0 &&
    input.nutrition.length === 0 &&
    input.habitLogs.length === 0 &&
    (input.mindfulness ?? []).length === 0 &&
    (input.activities ?? []).length === 0;

  const hasDemoData =
    input.sleep.some((r) => isDemoId(r.id)) ||
    input.checkins.some((r) => isDemoId(r.id)) ||
    input.focus.some((r) => isDemoId(r.id)) ||
    input.movement.some((r) => isDemoId(r.id)) ||
    input.nutrition.some((r) => isDemoId(r.id)) ||
    input.habits.some((r) => isDemoId(r.id)) ||
    input.habitLogs.some((r) => isDemoId(r.id)) ||
    (input.mindfulness ?? []).some((r) => isDemoId(r.id)) ||
    (input.activities ?? []).some((r) => isDemoId(r.id));

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
