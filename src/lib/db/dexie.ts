import Dexie, { type Table } from "dexie";

import type {
  DailyCheckin,
  Experiment,
  FocusSession,
  Habit,
  HabitLog,
  MovementLog,
  NutritionLog,
  SleepLog,
  UserSettings,
} from "@/types/domain";

/**
 * Bump when the Dexie schema or the serialized shape of a record changes.
 * Backups carry this number so an incompatible file is rejected instead of
 * being half-imported.
 */
export const SCHEMA_VERSION = 1;

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

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(SCHEMA_VERSION).stores({
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
