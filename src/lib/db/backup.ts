import { z } from "zod";

import { normalizeReminderSettings } from "@/features/reminders/reminderUtils";
import { SCHEMA_VERSION, getDb } from "@/lib/db/dexie";
import type {
  ActivityLog,
  Base,
  Block,
  DailyCheckin,
  DayPlan,
  DayPlanMeta,
  Experiment,
  FocusSession,
  GratitudeEntry,
  Habit,
  HabitLog,
  InsightFeedback,
  ISODateTime,
  JournalEntry,
  MicrotaskResult,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  Project,
  ReviewItem,
  SleepLog,
  Task,
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
  defaultBlockMin: z.number().int().min(15).max(240).optional(),
  deepWorkCapMin: z.number().int().min(15).max(720).optional(),
  snapMin: z.number().int().min(5).max(60).optional(),
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
  metric: z.enum([
    "concentration",
    "mood",
    "energy",
    "stress",
    "focusRating",
    "reactionTime",
    "memorySpan",
  ]),
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

const microtaskCommonFields = {
  ...baseFields,
  date: isoDate,
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  restedRating: rating.optional(),
  inputType: z.enum(["mouse", "touch", "keyboard"]),
};

const microtaskResultSchema = z.discriminatedUnion("task", [
  z.object({
    ...microtaskCommonFields,
    task: z.literal("reaction_time"),
    metrics: z.object({
      trialsMs: z.array(z.number().nonnegative()).min(1),
      medianMs: z.number().nonnegative(),
      bestMs: z.number().nonnegative(),
      falseStarts: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    ...microtaskCommonFields,
    task: z.literal("memory_span"),
    metrics: z.object({
      longestSpan: z.number().int().nonnegative(),
      startingLength: z.number().int().positive(),
      totalRounds: z.number().int().positive(),
      failures: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    ...microtaskCommonFields,
    task: z.literal("go_no_go"),
    metrics: z.object({
      totalTrials: z.number().int().positive(),
      goTrials: z.number().int().nonnegative(),
      noGoTrials: z.number().int().nonnegative(),
      hits: z.number().int().nonnegative(),
      misses: z.number().int().nonnegative(),
      commissionErrors: z.number().int().nonnegative(),
      meanReactionMs: z.number().nonnegative().nullable(),
    }),
  }),
]);

const projectSchema = z.object({
  ...baseFields,
  name: z.string().trim().min(1),
  color: z.string().optional(),
  archived: z.boolean(),
});

const taskSchema = z.object({
  ...baseFields,
  title: z.string().trim().min(1),
  projectId: z.string().min(1).optional(),
  notes: z.string().optional(),
  kind: z.enum(["deep", "shallow", "recovery"]),
  estimateMin: z.number().int().positive(),
  dueDate: isoDate.optional(),
  status: z.enum(["inbox", "active", "done", "archived"]),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
});

const blockSchema = z
  .object({
    ...baseFields,
    taskId: z.string().min(1),
    order: z.number().int().min(0),
    plannedMin: z.number().int().positive(),
    status: z.enum(["todo", "scheduled", "done", "skipped"]),
    plannedDate: isoDate.optional(),
    plannedStart: hhmmTime.optional(),
    actualMin: z.number().int().nonnegative().optional(),
    focusSessionId: z.string().min(1).optional(),
    completedAt: isoDateTime.optional(),
  })
  .refine((row) => !(row.plannedStart && !row.plannedDate), {
    message: "plannedStart requires plannedDate",
    path: ["plannedStart"],
  });

const dayPlanMetaSchema = z.object({
  ...baseFields,
  date: isoDate,
  shutdownDone: z.boolean(),
  reflection: z.string().optional(),
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

const v8TablesShape = v7TablesShape;

const v8BackupFileSchema = z.object({
  schemaVersion: z.literal(8),
  exportedAt: isoDateTime,
  tables: z.object(v8TablesShape),
});

const v9TablesShape = {
  ...v8TablesShape,
  microtaskResults: z.array(microtaskResultSchema),
};

const v9BackupFileSchema = z.object({
  schemaVersion: z.literal(9),
  exportedAt: isoDateTime,
  tables: z.object(v9TablesShape),
});

const v10TablesShape = {
  ...v9TablesShape,
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  blocks: z.array(blockSchema),
  dayPlanMeta: z.array(dayPlanMetaSchema),
};

export const backupFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: isoDateTime,
  tables: z.object(v10TablesShape),
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
  microtaskResults: MicrotaskResult[];
  projects: Project[];
  tasks: Task[];
  blocks: Block[];
  dayPlanMeta: DayPlanMeta[];
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
  "microtaskResults",
  "projects",
  "tasks",
  "blocks",
  "dayPlanMeta",
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
    microtaskResults: await db.microtaskResults.toArray(),
    projects: await db.projects.toArray(),
    tasks: await db.tasks.toArray(),
    blocks: await db.blocks.toArray(),
    dayPlanMeta: await db.dayPlanMeta.toArray(),
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
    defaultBlockMin: row.defaultBlockMin ?? 50,
    deepWorkCapMin: row.deepWorkCapMin ?? 240,
    snapMin: row.snapMin ?? 15,
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

type LegacyBackupSchema = z.ZodType<{ exportedAt: string; tables: Partial<BackupTables> }>;

const LEGACY_BACKUP_SCHEMAS: ReadonlyMap<number, LegacyBackupSchema> = new Map<
  number,
  LegacyBackupSchema
>([
  [1, v1BackupFileSchema],
  [2, v2BackupFileSchema],
  [3, v3BackupFileSchema],
  [4, v4BackupFileSchema],
  [5, v5BackupFileSchema],
  [6, v6BackupFileSchema],
  [7, v7BackupFileSchema],
  [8, v8BackupFileSchema],
  [9, v9BackupFileSchema],
]);

function upgradeTablesToCurrent(partial: Partial<BackupTables>): BackupTables {
  return {
    settings: normalizeSettingsRows(partial.settings ?? []),
    sleepLogs: partial.sleepLogs ?? [],
    checkins: partial.checkins ?? [],
    focusSessions: normalizeFocusSessions(partial.focusSessions ?? []),
    movementLogs: partial.movementLogs ?? [],
    nutritionLogs: partial.nutritionLogs ?? [],
    habits: partial.habits ?? [],
    habitLogs: partial.habitLogs ?? [],
    experiments: partial.experiments ?? [],
    mindfulnessSessions: partial.mindfulnessSessions ?? [],
    journalEntries: partial.journalEntries ?? [],
    gratitudeEntries: partial.gratitudeEntries ?? [],
    activityLogs: partial.activityLogs ?? [],
    reviewItems: partial.reviewItems ?? [],
    dayPlans: partial.dayPlans ?? [],
    insightFeedback: partial.insightFeedback ?? [],
    microtaskResults: partial.microtaskResults ?? [],
    projects: partial.projects ?? [],
    tasks: partial.tasks ?? [],
    blocks: partial.blocks ?? [],
    dayPlanMeta: partial.dayPlanMeta ?? [],
  };
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

  const legacySchema = LEGACY_BACKUP_SCHEMAS.get(version);
  if (legacySchema) {
    const data = validateWithSchema(legacySchema, raw);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: upgradeTablesToCurrent(data.tables),
    };
  }

  const data = validateWithSchema(backupFileSchema, raw);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: data.exportedAt,
    tables: upgradeTablesToCurrent(data.tables as BackupTables),
  };
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
