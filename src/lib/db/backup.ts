import { z } from "zod";

import { SCHEMA_VERSION, getDb } from "@/lib/db/dexie";
import type {
  ActivityLog,
  Base,
  DailyCheckin,
  Experiment,
  FocusSession,
  GratitudeEntry,
  Habit,
  HabitLog,
  ISODateTime,
  JournalEntry,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  ReviewItem,
  SleepLog,
  UserSettings,
} from "@/types/domain";

export { SCHEMA_VERSION };

const MIN_SUPPORTED_SCHEMA_VERSION = 1;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO 8601 timestamp");

const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const baseFields = {
  id: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

const settingsSchema = z.object({
  ...baseFields,
  displayName: z.string().optional(),
  sleepTargetMin: z.number().min(0).max(1440),
  focusDefaultMin: z.number().min(0).max(1440),
  breakDefaultMin: z.number().min(0).max(1440),
  onboarded: z.boolean(),
  reducedMotion: z.boolean().optional(),
  schemaVersion: z.number().int().positive(),
});

const sleepSchema = z.object({
  ...baseFields,
  date: isoDate,
  bedtime: isoDateTime,
  wakeTime: isoDateTime,
  durationMin: z.number().min(0).max(1440),
  quality: rating,
  rested: rating,
  interruptions: z.number().int().min(0),
});

const checkinSchema = z.object({
  ...baseFields,
  date: isoDate,
  mood: rating,
  stress: rating,
  energy: rating,
  concentration: rating,
  motivation: rating,
  outdoorMin: z.number().min(0).optional(),
  note: z.string().optional(),
});

const focusSchema = z.object({
  ...baseFields,
  date: isoDate,
  startedAt: isoDateTime,
  durationMin: z.number().min(0),
  plannedMin: z.number().min(0),
  subject: z.string(),
  method: z.enum([
    "active_recall",
    "spaced_repetition",
    "problem_solving",
    "deep_reading",
    "skill_practice",
    "teaching",
  ]),
  focusRating: rating,
  difficulty: rating,
  distractions: z.number().int().min(0),
  notes: z.string().optional(),
  practicedRetrieval: z.boolean().optional(),
  reviewedPrior: z.boolean().optional(),
});

const movementSchema = z.object({
  ...baseFields,
  date: isoDate,
  type: z.enum(["walk", "run", "cycle", "sport", "gym", "stretch", "other"]),
  durationMin: z.number().min(0),
  effort: rating,
});

const nutritionSchema = z.object({
  ...baseFields,
  date: isoDate,
  regularMeals: z.boolean(),
  fruitVeg: z.boolean(),
  varied: z.boolean(),
  waterGlasses: z.number().int().min(0),
  note: z.string().optional(),
});

const habitSchema = z.object({
  ...baseFields,
  name: z.string().min(1),
  icon: z.string().optional(),
  archived: z.boolean(),
});

const habitLogSchema = z.object({
  ...baseFields,
  date: isoDate,
  habitId: z.string().min(1),
  done: z.boolean(),
});

const experimentSchema = z.object({
  ...baseFields,
  title: z.string().min(1),
  hypothesis: z.string(),
  changeDescription: z.string(),
  metric: z.enum(["concentration", "mood", "energy", "stress", "focusRating"]),
  baselineStart: isoDate,
  baselineEnd: isoDate,
  interventionStart: isoDate,
  interventionEnd: isoDate,
  status: z.enum(["planned", "baseline", "intervention", "complete"]),
  reflection: z.string().optional(),
});

const mindfulnessSchema = z.object({
  ...baseFields,
  date: isoDate,
  type: z.enum(["box_breathing", "4_7_8_breathing", "meditation"]),
  durationMin: z.number().positive(),
});

const journalEntrySchema = z.object({
  ...baseFields,
  date: isoDate,
  text: z.string().trim().min(1),
});

const gratitudeEntrySchema = z.object({
  ...baseFields,
  date: isoDate,
  items: z.array(z.string().trim().min(1)).min(1).max(3),
});

const activityLogSchema = z.object({
  ...baseFields,
  date: isoDate,
  type: z.enum([
    "social",
    "creative",
    "music",
    "language_learning",
    "puzzles_games",
    "new_hobby",
    "novelty",
  ]),
  durationMin: z.number().positive(),
  enjoyment: rating,
  note: z.string().optional(),
});

const reviewItemSchema = z.object({
  ...baseFields,
  topic: z.string().trim().min(1),
  intervalStep: z.number().int().min(0).max(4),
  nextReviewDate: isoDate,
  lastReviewedDate: isoDate.optional(),
  reviewCount: z.number().int().min(0),
  notes: z.string().optional(),
});

const v1TablesShape = {
  settings: z.array(settingsSchema),
  sleepLogs: z.array(sleepSchema),
  checkins: z.array(checkinSchema),
  focusSessions: z.array(focusSchema),
  movementLogs: z.array(movementSchema),
  nutritionLogs: z.array(nutritionSchema),
  habits: z.array(habitSchema),
  habitLogs: z.array(habitLogSchema),
  experiments: z.array(experimentSchema),
};

const v2TablesShape = {
  ...v1TablesShape,
  mindfulnessSessions: z.array(mindfulnessSchema),
  journalEntries: z.array(journalEntrySchema),
  gratitudeEntries: z.array(gratitudeEntrySchema),
};

const v3TablesShape = {
  ...v2TablesShape,
  activityLogs: z.array(activityLogSchema),
};

const v1BackupFileSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: isoDateTime,
  tables: z.object(v1TablesShape),
});

const v2BackupFileSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: isoDateTime,
  tables: z.object(v2TablesShape),
});

const v3BackupFileSchema = z.object({
  schemaVersion: z.literal(3),
  exportedAt: isoDateTime,
  tables: z.object(v3TablesShape),
});

export const backupFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: isoDateTime,
  tables: z.object({
    ...v3TablesShape,
    reviewItems: z.array(reviewItemSchema),
  }),
});

export interface BackupTables {
  settings: UserSettings[];
  sleepLogs: SleepLog[];
  checkins: DailyCheckin[];
  focusSessions: FocusSession[];
  movementLogs: MovementLog[];
  nutritionLogs: NutritionLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  experiments: Experiment[];
  mindfulnessSessions: MindfulnessSession[];
  journalEntries: JournalEntry[];
  gratitudeEntries: GratitudeEntry[];
  activityLogs: ActivityLog[];
  reviewItems: ReviewItem[];
}

export interface BackupFile {
  schemaVersion: number;
  exportedAt: ISODateTime;
  tables: BackupTables;
}

export type BackupMode = "merge" | "replace";

export interface ImportSummary {
  mode: BackupMode;
  schemaVersion: number;
  imported: Record<string, number>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

const TABLE_NAMES = [
  "settings",
  "sleepLogs",
  "checkins",
  "focusSessions",
  "movementLogs",
  "nutritionLogs",
  "habits",
  "habitLogs",
  "experiments",
  "mindfulnessSessions",
  "journalEntries",
  "gratitudeEntries",
  "activityLogs",
  "reviewItems",
] as const satisfies readonly (keyof BackupTables)[];

/** Reads every table into one plain object. */
export async function buildBackup(): Promise<BackupFile> {
  const db = getDb();

  const tables: BackupTables = {
    settings: await db.settings.toArray(),
    sleepLogs: await db.sleepLogs.toArray(),
    checkins: await db.checkins.toArray(),
    focusSessions: await db.focusSessions.toArray(),
    movementLogs: await db.movementLogs.toArray(),
    nutritionLogs: await db.nutritionLogs.toArray(),
    habits: await db.habits.toArray(),
    habitLogs: await db.habitLogs.toArray(),
    experiments: await db.experiments.toArray(),
    mindfulnessSessions: await db.mindfulnessSessions.toArray(),
    journalEntries: await db.journalEntries.toArray(),
    gratitudeEntries: await db.gratitudeEntries.toArray(),
    activityLogs: await db.activityLogs.toArray(),
    reviewItems: await db.reviewItems.toArray(),
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** The full local database as a downloadable JSON blob. Contains no network calls. */
export async function exportAll(): Promise<Blob> {
  const backup = await buildBackup();
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

function normalizeFocusSessions(rows: FocusSession[]): FocusSession[] {
  return rows.map((row) => ({
    ...row,
    practicedRetrieval: row.practicedRetrieval ?? row.method === "active_recall",
    reviewedPrior: row.reviewedPrior ?? row.method === "spaced_repetition",
  }));
}

function parseBackup(text: string): BackupFile {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("This file is not valid JSON, so nothing was imported.");
  }

  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;

  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new BackupError(
      "This file does not look like a NeuroSync backup: it has no schemaVersion.",
    );
  }

  if (version < MIN_SUPPORTED_SCHEMA_VERSION || version > SCHEMA_VERSION) {
    throw new BackupError(
      `This backup uses schema version ${version}, but this app supports versions ${MIN_SUPPORTED_SCHEMA_VERSION}–${SCHEMA_VERSION}. Nothing was imported.`,
    );
  }

  if (version === 1) {
    const parsedV1 = v1BackupFileSchema.safeParse(raw);
    if (!parsedV1.success) {
      const firstIssue = parsedV1.error.issues[0];
      const location = firstIssue?.path.join(".") || "unknown field";
      throw new BackupError(
        `This backup failed validation (${location}: ${firstIssue?.message ?? "invalid value"}). Nothing was imported.`,
      );
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: parsedV1.data.exportedAt,
      tables: {
        ...parsedV1.data.tables,
        settings: parsedV1.data.tables.settings.map((row) => ({
          ...row,
          schemaVersion: SCHEMA_VERSION,
        })),
        focusSessions: normalizeFocusSessions(parsedV1.data.tables.focusSessions),
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
      },
    };
  }

  if (version === 2) {
    const parsedV2 = v2BackupFileSchema.safeParse(raw);
    if (!parsedV2.success) {
      const firstIssue = parsedV2.error.issues[0];
      const location = firstIssue?.path.join(".") || "unknown field";
      throw new BackupError(
        `This backup failed validation (${location}: ${firstIssue?.message ?? "invalid value"}). Nothing was imported.`,
      );
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: parsedV2.data.exportedAt,
      tables: {
        ...parsedV2.data.tables,
        settings: parsedV2.data.tables.settings.map((row) => ({
          ...row,
          schemaVersion: SCHEMA_VERSION,
        })),
        focusSessions: normalizeFocusSessions(parsedV2.data.tables.focusSessions),
        activityLogs: [],
        reviewItems: [],
      },
    };
  }

  if (version === 3) {
    const parsedV3 = v3BackupFileSchema.safeParse(raw);
    if (!parsedV3.success) {
      const firstIssue = parsedV3.error.issues[0];
      const location = firstIssue?.path.join(".") || "unknown field";
      throw new BackupError(
        `This backup failed validation (${location}: ${firstIssue?.message ?? "invalid value"}). Nothing was imported.`,
      );
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: parsedV3.data.exportedAt,
      tables: {
        ...parsedV3.data.tables,
        settings: parsedV3.data.tables.settings.map((row) => ({
          ...row,
          schemaVersion: SCHEMA_VERSION,
        })),
        focusSessions: normalizeFocusSessions(parsedV3.data.tables.focusSessions),
        reviewItems: [],
      },
    };
  }

  const parsed = backupFileSchema.safeParse(raw);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const location = firstIssue?.path.join(".") || "unknown field";
    throw new BackupError(
      `This backup failed validation (${location}: ${firstIssue?.message ?? "invalid value"}). Nothing was imported.`,
    );
  }

  return parsed.data as BackupFile;
}

/**
 * Validates the whole file first and only then writes it inside a single
 * transaction, so a bad row can never leave a partially imported database.
 */
export async function importAll(
  file: Blob | string,
  mode: BackupMode = "merge",
): Promise<ImportSummary> {
  const text = typeof file === "string" ? file : await file.text();
  const backup = parseBackup(text);
  const db = getDb();
  const imported: Record<string, number> = {};

  await db.transaction("rw", db.tables, async () => {
    if (mode === "replace") {
      await Promise.all(db.tables.map((table) => table.clear()));
    }

    for (const name of TABLE_NAMES) {
      const rows = backup.tables[name] as unknown as Base[];

      if (rows.length === 0) {
        imported[name] = 0;
        continue;
      }

      await db.table(name).bulkPut(rows);
      imported[name] = rows.length;
    }
  });

  return { mode, schemaVersion: SCHEMA_VERSION, imported };
}
