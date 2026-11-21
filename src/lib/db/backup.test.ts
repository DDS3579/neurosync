import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";

import { BackupError, SCHEMA_VERSION, buildBackup, exportAll, importAll } from "@/lib/db/backup";
import { NeuroSyncDatabase, getDb } from "@/lib/db/dexie";
import {
  activityRepository,
  blockRepository,
  checkinRepository,
  dayPlanMetaRepository,
  dayPlanRepository,
  focusRepository,
  gratitudeRepository,
  habitLogRepository,
  habitRepository,
  insightFeedbackRepository,
  journalRepository,
  microtaskRepository,
  mindfulnessRepository,
  projectRepository,
  reviewRepository,
  settingsRepository,
  sleepRepository,
  taskRepository,
} from "@/lib/db/repositories";

const DATE = "2026-03-02";

async function clearDatabase(): Promise<void> {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seed(): Promise<void> {
  await settingsRepository.ensure();

  await sleepRepository.create({
    date: DATE,
    bedtime: `${DATE}T23:10:00.000Z`,
    wakeTime: `${DATE}T07:00:00.000Z`,
    durationMin: 470,
    quality: 4,
    rested: 3,
    interruptions: 1,
  });

  await checkinRepository.create({
    date: DATE,
    mood: 4,
    stress: 2,
    energy: 3,
    concentration: 3,
    motivation: 4,
    outdoorMin: 25,
  });

  await focusRepository.create({
    date: DATE,
    startedAt: `${DATE}T09:00:00.000Z`,
    durationMin: 25,
    plannedMin: 25,
    subject: "Neuroanatomy",
    method: "active_recall",
    focusRating: 4,
    difficulty: 3,
    distractions: 0,
    practicedRetrieval: true,
    reviewedPrior: false,
  });

  const habit = await habitRepository.create({ name: "Evening walk", archived: false });

  await habitLogRepository.create({ date: DATE, habitId: habit.id, done: true });

  await mindfulnessRepository.create({
    date: DATE,
    type: "box_breathing",
    durationMin: 3,
  });

  await journalRepository.create({
    date: DATE,
    text: "Quiet morning before reading notes.",
  });

  await gratitudeRepository.create({
    date: DATE,
    items: ["Warm tea", "Uninterrupted focus block"],
  });

  await activityRepository.create({
    date: DATE,
    type: "puzzles_games",
    durationMin: 25,
    enjoyment: 4,
    note: "Crossword over tea",
  });

  await reviewRepository.create({
    topic: "Hippocampal memory indexing",
    intervalStep: 1,
    nextReviewDate: "2026-03-05",
    lastReviewedDate: DATE,
    reviewCount: 1,
  });

  await dayPlanRepository.create({
    date: DATE,
    wakeTime: "07:00",
    sleepTargetMin: 480,
    windDownMin: 45,
    maxStudyBlockMin: 50,
    breakMin: 10,
    bufferMin: 10,
    movementGoalMin: 30,
    preferRecoverySpacing: true,
    commitments: [{ id: "c1", title: "Class", startTime: "09:00", endTime: "11:00" }],
    studyGoals: [{ id: "g1", subject: "Neuro", minutes: 50, difficulty: 4 }],
    blocks: [
      {
        id: "b1",
        kind: "study",
        title: "Neuro",
        startTime: "14:00",
        endTime: "14:50",
        durationMin: 50,
        subject: "Neuro",
        difficulty: 4,
      },
    ],
    unscheduled: [],
  });

  await insightFeedbackRepository.dismiss({
    id: "sleep_below_target",
    title: "A few shorter nights this week",
    pillar: "sleep",
  });

  await microtaskRepository.create({
    date: DATE,
    task: "reaction_time",
    timeOfDay: "morning",
    restedRating: 4,
    inputType: "keyboard",
    metrics: {
      trialsMs: [280, 295, 310, 325, 340],
      medianMs: 310,
      bestMs: 280,
      falseStarts: 0,
    },
  });

  const project = await projectRepository.create({
    name: "Neurobiology",
    color: "#8B5CF6",
    archived: false,
  });

  const task = await taskRepository.create({
    title: "Synaptic plasticity chapter",
    projectId: project.id,
    kind: "deep",
    estimateMin: 100,
    dueDate: DATE,
    status: "active",
    repeatWeekdays: [1, 3, 5],
  });

  await blockRepository.bulkCreate([
    {
      taskId: task.id,
      order: 0,
      plannedMin: 50,
      status: "scheduled",
      plannedDate: DATE,
      plannedStart: "09:00",
    },
    {
      taskId: task.id,
      order: 1,
      plannedMin: 50,
      status: "todo",
    },
  ]);

  await dayPlanMetaRepository.setShutdownDone(DATE, true, "Wrapped up cleanly before wind-down.");
}

describe("backup round-trip", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("exports every table, wipes the database, and restores identical records", async () => {
    await seed();

    const before = await buildBackup();
    const blob = await exportAll();
    const text = await blob.text();

    expect(text).toContain("schemaVersion");

    await clearDatabase();
    expect(await getDb().sleepLogs.count()).toBe(0);

    const summary = await importAll(text, "replace");
    const after = await buildBackup();

    expect(after.tables).toEqual(before.tables);
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.mode).toBe("replace");
    expect(summary.imported.sleepLogs).toBe(1);
    expect(summary.imported.habitLogs).toBe(1);
    expect(summary.imported.mindfulnessSessions).toBe(1);
    expect(summary.imported.journalEntries).toBe(1);
    expect(summary.imported.gratitudeEntries).toBe(1);
    expect(summary.imported.activityLogs).toBe(1);
    expect(summary.imported.reviewItems).toBe(1);
    expect(summary.imported.dayPlans).toBe(1);
    expect(summary.imported.insightFeedback).toBe(1);
    expect(summary.imported.microtaskResults).toBe(1);
    expect(summary.imported.projects).toBe(1);
    expect(summary.imported.tasks).toBe(1);
    expect(summary.imported.blocks).toBe(2);
    expect(summary.imported.dayPlanMeta).toBe(1);
  });

  it("imports a v0.1 backup (schemaVersion 1) and migrates settings to current schema", async () => {
    const v1Backup = {
      schemaVersion: 1,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [
          {
            id: "me",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            sleepTargetMin: 480,
            focusDefaultMin: 25,
            breakDefaultMin: 5,
            onboarded: true,
            schemaVersion: 1,
          },
        ],
        sleepLogs: [
          {
            id: "sleep-v1",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            date: DATE,
            bedtime: `${DATE}T23:00:00.000Z`,
            wakeTime: `${DATE}T07:00:00.000Z`,
            durationMin: 480,
            quality: 4,
            rested: 4,
            interruptions: 0,
          },
        ],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
      },
    };

    const summary = await importAll(JSON.stringify(v1Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.sleepLogs).toBe(1);
    expect(summary.imported.mindfulnessSessions).toBe(0);

    const restoredSettings = await getDb().settings.get("me");
    expect(restoredSettings?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restoredSettings?.highContrast).toBe(false);
    expect(restoredSettings?.textSize).toBe("md");
    expect(restoredSettings?.reminders?.windDown.enabled).toBe(false);
    expect(restoredSettings?.defaultBlockMin).toBe(50);
    expect(restoredSettings?.deepWorkCapMin).toBe(240);
    expect(restoredSettings?.snapMin).toBe(15);
    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().activityLogs.count()).toBe(0);
    expect(await getDb().projects.count()).toBe(0);
    expect(await getDb().tasks.count()).toBe(0);
    expect(await getDb().blocks.count()).toBe(0);
    expect(await getDb().dayPlanMeta.count()).toBe(0);
  });

  it("imports a v2 backup (schemaVersion 2) and migrates settings to current schema", async () => {
    const v2Backup = {
      schemaVersion: 2,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [
          {
            id: "me",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            sleepTargetMin: 480,
            focusDefaultMin: 25,
            breakDefaultMin: 5,
            onboarded: true,
            schemaVersion: 2,
          },
        ],
        sleepLogs: [],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
        mindfulnessSessions: [
          {
            id: "mind-v2",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            date: DATE,
            type: "meditation",
            durationMin: 10,
          },
        ],
        journalEntries: [],
        gratitudeEntries: [],
      },
    };

    const summary = await importAll(JSON.stringify(v2Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.mindfulnessSessions).toBe(1);
    expect(summary.imported.activityLogs).toBe(0);
    expect((await getDb().settings.get("me"))?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("imports a v6 backup cleanly with empty insightFeedback", async () => {
    const v6Backup = {
      schemaVersion: 6,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [],
        sleepLogs: [],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
      },
    };

    const summary = await importAll(JSON.stringify(v6Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.insightFeedback).toBe(0);
    expect(await getDb().insightFeedback.count()).toBe(0);
  });

  it("imports a v7 backup cleanly and initializes v8 display preferences", async () => {
    const v7Backup = {
      schemaVersion: 7,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [
          {
            id: "me",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            sleepTargetMin: 480,
            focusDefaultMin: 25,
            breakDefaultMin: 5,
            onboarded: true,
            schemaVersion: 7,
          },
        ],
        sleepLogs: [],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
      },
    };

    const summary = await importAll(JSON.stringify(v7Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    const settings = await getDb().settings.get("me");
    expect(settings?.highContrast).toBe(false);
    expect(settings?.textSize).toBe("md");
    expect(settings?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.microtaskResults).toBe(0);
  });

  it("imports a v8 backup cleanly with empty microtaskResults", async () => {
    const v8Backup = {
      schemaVersion: 8,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [
          {
            id: "me",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            sleepTargetMin: 480,
            focusDefaultMin: 25,
            breakDefaultMin: 5,
            onboarded: true,
            highContrast: false,
            textSize: "md",
            schemaVersion: 8,
          },
        ],
        sleepLogs: [],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
      },
    };

    const summary = await importAll(JSON.stringify(v8Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.microtaskResults).toBe(0);
    expect((await getDb().settings.get("me"))?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await getDb().microtaskResults.count()).toBe(0);
  });

  it("imports a v9 backup cleanly with empty v10 planner tables and default settings", async () => {
    const v9Backup = {
      schemaVersion: 9,
      exportedAt: `${DATE}T12:00:00.000Z`,
      tables: {
        settings: [
          {
            id: "me",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            sleepTargetMin: 480,
            focusDefaultMin: 25,
            breakDefaultMin: 5,
            onboarded: true,
            highContrast: false,
            textSize: "md",
            schemaVersion: 9,
          },
        ],
        sleepLogs: [],
        checkins: [],
        focusSessions: [],
        movementLogs: [],
        nutritionLogs: [],
        habits: [],
        habitLogs: [],
        experiments: [],
        mindfulnessSessions: [],
        journalEntries: [],
        gratitudeEntries: [],
        activityLogs: [],
        reviewItems: [],
        dayPlans: [],
        insightFeedback: [],
        microtaskResults: [
          {
            id: "mt-v9",
            createdAt: `${DATE}T08:00:00.000Z`,
            updatedAt: `${DATE}T08:00:00.000Z`,
            date: DATE,
            timeOfDay: "morning",
            inputType: "keyboard",
            task: "reaction_time",
            metrics: { trialsMs: [280, 290], medianMs: 285, bestMs: 280, falseStarts: 0 },
          },
        ],
      },
    };

    const summary = await importAll(JSON.stringify(v9Backup), "replace");
    expect(summary.schemaVersion).toBe(SCHEMA_VERSION);
    expect(summary.imported.microtaskResults).toBe(1);
    expect(summary.imported.projects).toBe(0);
    expect(summary.imported.tasks).toBe(0);
    expect(summary.imported.blocks).toBe(0);
    expect(summary.imported.dayPlanMeta).toBe(0);
    const settings = await getDb().settings.get("me");
    expect(settings?.defaultBlockMin).toBe(50);
    expect(settings?.deepWorkCapMin).toBe(240);
    expect(settings?.snapMin).toBe(15);
    expect(settings?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("upgrades an existing Dexie v9 database to v10 preserving rows and migrating settings", async () => {
    const dbName = `neurosync-v9-to-v10-${Date.now()}`;
    const v9Db = new Dexie(dbName);
    v9Db.version(9).stores({
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
      microtaskResults: "id, date, task",
    });
    await v9Db.open();
    await v9Db.table("settings").put({
      id: "me",
      createdAt: `${DATE}T08:00:00.000Z`,
      updatedAt: `${DATE}T08:00:00.000Z`,
      sleepTargetMin: 480,
      focusDefaultMin: 25,
      breakDefaultMin: 5,
      onboarded: true,
      schemaVersion: 9,
    });
    await v9Db.table("microtaskResults").put({
      id: "mt-preserve",
      createdAt: `${DATE}T09:00:00.000Z`,
      updatedAt: `${DATE}T09:00:00.000Z`,
      date: DATE,
      timeOfDay: "morning",
      inputType: "mouse",
      task: "memory_span",
      metrics: { longestSpan: 5, startingLength: 3, totalRounds: 4, failures: 2 },
    });
    v9Db.close();

    const upgradedDb = new NeuroSyncDatabase(dbName);
    await upgradedDb.open();
    const migratedSettings = await upgradedDb.settings.get("me");
    const preservedMt = await upgradedDb.microtaskResults.get("mt-preserve");
    expect(migratedSettings?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migratedSettings?.defaultBlockMin).toBe(50);
    expect(migratedSettings?.deepWorkCapMin).toBe(240);
    expect(migratedSettings?.snapMin).toBe(15);
    expect(preservedMt?.task).toBe("memory_span");
    expect(await upgradedDb.projects.count()).toBe(0);
    expect(await upgradedDb.tasks.count()).toBe(0);
    expect(await upgradedDb.blocks.count()).toBe(0);
    expect(await upgradedDb.dayPlanMeta.count()).toBe(0);
    upgradedDb.close();
    await Dexie.delete(dbName);
  });

  it("upgrades an existing Dexie v1 database to v3 preserving rows and migrating settings", async () => {
    const dbName = `neurosync-migration-test-${Date.now()}`;
    const v1Db = new Dexie(dbName);
    v1Db.version(1).stores({
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
    await v1Db.open();
    await v1Db.table("settings").put({
      id: "me",
      createdAt: `${DATE}T08:00:00.000Z`,
      updatedAt: `${DATE}T08:00:00.000Z`,
      sleepTargetMin: 480,
      focusDefaultMin: 25,
      breakDefaultMin: 5,
      onboarded: true,
      schemaVersion: 1,
    });
    await v1Db.table("focusSessions").put({
      id: "focus-v1",
      createdAt: `${DATE}T09:00:00.000Z`,
      updatedAt: `${DATE}T09:00:00.000Z`,
      date: DATE,
      startedAt: `${DATE}T09:00:00.000Z`,
      durationMin: 25,
      plannedMin: 25,
      subject: "Recall drill",
      method: "active_recall",
      focusRating: 4,
      difficulty: 3,
      distractions: 0,
    });
    v1Db.close();

    const upgradedDb = new NeuroSyncDatabase(dbName);
    await upgradedDb.open();
    const migratedSettings = await upgradedDb.settings.get("me");
    const migratedFocus = await upgradedDb.focusSessions.get("focus-v1");
    expect(migratedSettings?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migratedSettings?.reminders?.checkin.time).toBe("20:00");
    expect(migratedFocus?.practicedRetrieval).toBe(true);
    expect(migratedFocus?.reviewedPrior).toBe(false);
    expect(await upgradedDb.mindfulnessSessions.count()).toBe(0);
    expect(await upgradedDb.journalEntries.count()).toBe(0);
    expect(await upgradedDb.gratitudeEntries.count()).toBe(0);
    expect(await upgradedDb.activityLogs.count()).toBe(0);
    expect(await upgradedDb.reviewItems.count()).toBe(0);
    expect(await upgradedDb.dayPlans.count()).toBe(0);
    expect(await upgradedDb.insightFeedback.count()).toBe(0);
    expect(await upgradedDb.microtaskResults.count()).toBe(0);
    upgradedDb.close();
    await Dexie.delete(dbName);
  });

  it("merges without deleting existing records", async () => {
    await seed();
    const text = JSON.stringify(await buildBackup());

    const summary = await importAll(text, "merge");

    expect(summary.mode).toBe("merge");
    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().habits.count()).toBe(1);
  });

  it("rejects an unknown schema version and leaves the database untouched", async () => {
    await seed();
    const good = await buildBackup();
    const incompatible = JSON.stringify({ ...good, schemaVersion: good.schemaVersion + 1 });

    await expect(importAll(incompatible, "replace")).rejects.toBeInstanceOf(BackupError);
    expect(await getDb().sleepLogs.count()).toBe(1);
  });

  it("rejects a corrupt block payload atomically", async () => {
    await seed();
    const good = await buildBackup();
    const broken = JSON.parse(JSON.stringify(good)) as {
      tables: { blocks: Array<Record<string, unknown>> };
    };
    // plannedStart without plannedDate violates the block invariant.
    broken.tables.blocks.push({
      id: "corrupt-block",
      createdAt: `${DATE}T08:00:00.000Z`,
      updatedAt: `${DATE}T08:00:00.000Z`,
      taskId: "missing-task",
      order: 9,
      plannedMin: 30,
      status: "scheduled",
      plannedStart: "09:00",
    });

    await expect(importAll(JSON.stringify(broken), "replace")).rejects.toBeInstanceOf(BackupError);

    expect(await getDb().blocks.count()).toBe(2);
    expect(await getDb().tasks.count()).toBe(1);
    expect(await getDb().projects.count()).toBe(1);
    expect(await getDb().sleepLogs.count()).toBe(1);
  });

  it("a replace import clears planner tables and leaves no orphan blocks", async () => {
    await seed();
    expect(await getDb().blocks.count()).toBe(2);

    const good = await buildBackup();
    const plannerFree = JSON.parse(JSON.stringify(good)) as {
      tables: Record<string, unknown[]>;
    };
    plannerFree.tables.projects = [];
    plannerFree.tables.tasks = [];
    plannerFree.tables.blocks = [];
    plannerFree.tables.dayPlanMeta = [];

    const summary = await importAll(JSON.stringify(plannerFree), "replace");

    expect(summary.mode).toBe("replace");
    expect(await getDb().blocks.count()).toBe(0);
    expect(await getDb().tasks.count()).toBe(0);
    expect(await getDb().projects.count()).toBe(0);
    expect(await getDb().dayPlanMeta.count()).toBe(0);
    const orphan = await getDb()
      .blocks.filter((block) => Boolean(block.taskId))
      .count();
    expect(orphan).toBe(0);
  });

  it("never partially imports an invalid file", async () => {
    await seed();
    const good = await buildBackup();
    const broken = JSON.parse(JSON.stringify(good)) as { tables: { sleepLogs: unknown[] } };
    broken.tables.sleepLogs.push({ id: "missing-required-fields" });

    await expect(importAll(JSON.stringify(broken), "replace")).rejects.toBeInstanceOf(BackupError);

    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().habits.count()).toBe(1);
  });
});
