import Dexie, { type Table } from "dexie";

import { DEFAULT_REMINDER_SETTINGS } from "@/features/reminders/reminderUtils";
import type {
  ActivityLog,
  DailyCheckin,
  DayPlan,
  Experiment,
  FocusSession,
  GratitudeEntry,
  Habit,
  HabitLog,
  InsightFeedback,
  JournalEntry,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  ReminderSettings,
  ReviewItem,
  SleepLog,
  TextSizePref,
  UserSettings,
} from "@/types/domain";

/**
 * Bump when the Dexie schema or the serialized shape of a record changes.
 * Backups carry this number so an incompatible file is rejected instead of
 * being half-imported.
 */
export const SCHEMA_VERSION = 8;

export const DB_NAME = "neurosync";

/** The settings table always holds exactly one row, and it uses this id. */
export const SETTINGS_ID = "me";

export class NeuroSyncDatabase extends Dexie {
  settings!: Table<UserSettings, string>;
  sleepLogs!: Table<SleepLog, string>;
  checkins!: Table<DailyCheckin, string>;
  focusSessions!: Table<FocusSession, string>;
  movementLogs!: Table<MovementLog, string>;
  nutritionLogs!: Table<NutritionLog, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  experiments!: Table<Experiment, string>;
  mindfulnessSessions!: Table<MindfulnessSession, string>;
  journalEntries!: Table<JournalEntry, string>;
  gratitudeEntries!: Table<GratitudeEntry, string>;
  activityLogs!: Table<ActivityLog, string>;
  reviewItems!: Table<ReviewItem, string>;
  dayPlans!: Table<DayPlan, string>;
  insightFeedback!: Table<InsightFeedback, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      settings: "id",
      sleepLogs: "id, date",
      checkins: "id, date",
      focusSessions: "id, date, subject, method",
      movementLogs: "id, date, type",
      nutritionLogs: "id, date",
      habits: "id, archived",
      habitLogs: "id, date, habitId, [date+habitId]",
      experiments: "id, status, metric, baselineStart",
    });

    this.version(2)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number }) => {
            row.schemaVersion = 2;
          });
      });

    this.version(3)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number }) => {
            row.schemaVersion = 3;
          });
      });

    this.version(4)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
        reviewItems: "id, nextReviewDate, intervalStep",
      })
      .upgrade(async (tx) => {
        await tx
          .table("focusSessions")
          .toCollection()
          .modify(
            (row: {
              method?: string;
              practicedRetrieval?: boolean;
              reviewedPrior?: boolean;
            }) => {
              if (row.practicedRetrieval === undefined) {
                row.practicedRetrieval = row.method === "active_recall";
              }
              if (row.reviewedPrior === undefined) {
                row.reviewedPrior = row.method === "spaced_repetition";
              }
            },
          );

        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number }) => {
            row.schemaVersion = 4;
          });
      });

    this.version(5)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
        reviewItems: "id, nextReviewDate, intervalStep",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number; reminders?: ReminderSettings }) => {
            if (!row.reminders) {
              row.reminders = structuredClone(DEFAULT_REMINDER_SETTINGS);
            }
            row.schemaVersion = 5;
          });
      });

    this.version(6)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
        reviewItems: "id, nextReviewDate, intervalStep",
        dayPlans: "id, date",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number }) => {
            row.schemaVersion = 6;
          });
      });

    this.version(7)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
        reviewItems: "id, nextReviewDate, intervalStep",
        dayPlans: "id, date",
        insightFeedback: "id, insightId, status",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((row: { schemaVersion?: number }) => {
            row.schemaVersion = 7;
          });
      });

    this.version(SCHEMA_VERSION)
      .stores({
        settings: "id",
        sleepLogs: "id, date",
        checkins: "id, date",
        focusSessions: "id, date, subject, method",
        movementLogs: "id, date, type",
        nutritionLogs: "id, date",
        habits: "id, archived",
        habitLogs: "id, date, habitId, [date+habitId]",
        experiments: "id, status, metric, baselineStart",
        mindfulnessSessions: "id, date, type",
        journalEntries: "id, date",
        gratitudeEntries: "id, date",
        activityLogs: "id, date, type",
        reviewItems: "id, nextReviewDate, intervalStep",
        dayPlans: "id, date",
        insightFeedback: "id, insightId, status",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify(
            (row: {
              schemaVersion?: number;
              highContrast?: boolean;
              textSize?: TextSizePref;
            }) => {
              if (row.highContrast === undefined) row.highContrast = false;
              if (row.textSize === undefined) row.textSize = "md";
              row.schemaVersion = SCHEMA_VERSION;
            },
          );
      });
  }
}

/**
 * IndexedDB only exists in the browser. Repositories and hooks check this
 * before touching the database so server rendering never opens it.
 */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let instance: NeuroSyncDatabase | null = null;

/**
 * Lazily creates the single browser database instance. Components must not
 * call this: they go through repositories or `lib/db/hooks`.
 */
export function getDb(): NeuroSyncDatabase {
  if (!isIndexedDbAvailable()) {
    throw new Error(
      "The NeuroSync database is only available in the browser. Read data through lib/db/hooks in a client component.",
    );
  }
  if (!instance) {
    instance = new NeuroSyncDatabase();
  }
  return instance;
}
