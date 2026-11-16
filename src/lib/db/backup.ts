import { z } from "zod";

import { normalizeReminderSettings } from "@/features/reminders/reminderUtils";
import { SCHEMA_VERSION, getDb } from "@/lib/db/dexie";
import type {
  ActivityLog,
  Base,
  DailyCheckin,
  DayPlan,
  Experiment,
  FocusSession,
  GratitudeEntry,
  Habit,
  HabitLog,
  InsightFeedback,
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

const hhmmTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM 24-hour time");

const reminderSlotSchema = z.object({
  enabled: z.boolean(),
  time: hhmmTime,
});

const reminderSettingsSchema = z.object({
  windDown: reminderSlotSchema,
  checkin: reminderSlotSchema,
  reviewDue: reminderSlotSchema,
  quietHours: z.object({
    enabled: z.boolean(),
    start: hhmmTime,
    end: hhmmTime,
  }),
});

const settingsSchema = z.object({
  ...baseFields,
  displayName: z.string().optional(),
  sleepTargetMin: z.number().min(0).max(1440),
  focusDefaultMin: z.number().min(0).max(1440),
  breakDefaultMin: z.number().min(0).max(1440),
  onboarded: z.boolean(),
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  textSize: z.enum(["sm", "md", "lg"]).optional(),
  reminders: reminderSettingsSchema.optional(),
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

const dayPlanSchema = z.object({
  ...baseFields,
  date: isoDate,
  wakeTime: hhmmTime,
  sleepTargetMin: z.number().int().min(60).max(960),
  windDownMin: z.number().int().min(0).max(360),
  maxStudyBlockMin: z.number().int().min(15).max(180),
  breakMin: z.number().int().min(0).max(120),
  bufferMin: z.number().int().min(0).max(120),
  movementGoalMin: z.number().int().min(0).max(360),
  preferRecoverySpacing: z.boolean(),
  commitments: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      startTime: hhmmTime,
      endTime: hhmmTime,
    }),
  ),
  studyGoals: z.array(
    z.object({
      id: z.string().min(1),
      subject: z.string().min(1),
      minutes: z.number().int().positive(),
      difficulty: rating.optional(),
    }),
  ),
  blocks: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["fixed", "study", "break", "movement", "recovery", "wind_down", "sleep"]),
      title: z.string().min(1),
      startTime: hhmmTime,
      endTime: hhmmTime,
      durationMin: z.number().int().nonnegative(),
      subject: z.string().optional(),
      difficulty: rating.optional(),
      notes: z.string().optional(),
    }),
  ),
  unscheduled: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      kind: z.enum(["study", "movement", "fixed"]),
      minutes: z.number().int().nonnegative(),
      reason: z.string(),
    }),
  ),
});

const insightFeedbackSchema = z.object({
  ...baseFields,
  insightId: z.string().min(1),
  status: z.enum(["dismissed", "snoozed"]),
  snoozeUntil: isoDate.optional(),
  title: z.string().optional(),
  pillar: z.enum(["sleep", "focus", "movement", "nutrition", "wellbeing", "learning"]).optional(),
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

const v4TablesShape = {
  ...v3TablesShape,
  reviewItems: z.array(reviewItemSchema),
};

const v5TablesShape = v4TablesShape;

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

const v4BackupFileSchema = z.object({
  schemaVersion: z.literal(4),
  exportedAt: isoDateTime,
  tables: z.object(v4TablesShape),
});

const v5BackupFileSchema = z.object({
  schemaVersion: z.literal(5),
  exportedAt: isoDateTime,
  tables: z.object(v5TablesShape),
});

const v6TablesShape = {
  ...v5TablesShape,
  dayPlans: z.array(dayPlanSchema),
};

const v7TablesShape = {
  ...v6TablesShape,
  insightFeedback: z.array(insightFeedbackSchema),
};

const v6BackupFileSchema = z.object({
  schemaVersion: z.literal(6),
  exportedAt: isoDateTime,
  tables: z.object(v6TablesShape),
});

const v7BackupFileSchema = z.object({
  schemaVersion: z.literal(7),
  exportedAt: isoDateTime,
  tables: z.object(v7TablesShape),
});

export const backupFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: isoDateTime,
  tables: z.object(v7TablesShape),
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
  dayPlans: DayPlan[];
  insightFeedback: InsightFeedback[];
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
  "dayPlans",
  "insightFeedback",
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
    dayPlans: await db.dayPlans.toArray(),
    insightFeedback: await db.insightFeedback.toArray(),
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

function normalizeSettingsRows(rows: UserSettings[]): UserSettings[] {
  return rows.map((row) => ({
    ...row,
    highContrast: row.highContrast ?? false,
    textSize: row.textSize ?? "md",
    reminders: normalizeReminderSettings(row.reminders),
    schemaVersion: SCHEMA_VERSION,
  }));
}

function validateWithSchema<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const location = firstIssue?.path.join(".") || "unknown field";
    throw new BackupError(
      `This backup failed validation (${location}: ${firstIssue?.message ?? "invalid value"}). Nothing was imported.`,
    );
  }
  return parsed.data;
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
    const data = validateWithSchema(v1BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
      },
    };
  }

  if (version === 2) {
    const data = validateWithSchema(v2BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
      },
    };
  }

  if (version === 3) {
    const data = validateWithSchema(v3BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
      },
    };
  }

  if (version === 4) {
    const data = validateWithSchema(v4BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        dayPlans: [],
        insightFeedback: [],
      },
    };
  }

  if (version === 5) {
    const data = validateWithSchema(v5BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        dayPlans: [],
        insightFeedback: [],
      },
    };
  }

  if (version === 6) {
    const data = validateWithSchema(v6BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
        insightFeedback: [],
      },
    };
  }

  if (version === 7) {
    const data = validateWithSchema(v7BackupFileSchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: {
        ...data.tables,
        settings: normalizeSettingsRows(data.tables.settings),
        focusSessions: normalizeFocusSessions(data.tables.focusSessions),
      },
    };
  }

  const data = validateWithSchema(backupFileSchema, raw);
  return data as BackupFile;
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
