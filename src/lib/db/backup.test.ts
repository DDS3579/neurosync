import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";

import { BackupError, SCHEMA_VERSION, buildBackup, exportAll, importAll } from "@/lib/db/backup";
import { NeuroSyncDatabase, getDb } from "@/lib/db/dexie";
import {
  checkinRepository,
  focusRepository,
  gratitudeRepository,
  habitLogRepository,
  habitRepository,
  journalRepository,
  mindfulnessRepository,
  settingsRepository,
  sleepRepository,
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
  });

  it("imports a v0.1 backup (schemaVersion 1) and migrates settings to v2", async () => {
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
    expect(await getDb().sleepLogs.count()).toBe(1);
  });

  it("upgrades an existing Dexie v1 database to v2 preserving rows and migrating settings", async () => {
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
    v1Db.close();

    const upgradedDb = new NeuroSyncDatabase(dbName);
    await upgradedDb.open();
    const migratedSettings = await upgradedDb.settings.get("me");
    expect(migratedSettings?.schemaVersion).toBe(2);
    expect(await upgradedDb.mindfulnessSessions.count()).toBe(0);
    expect(await upgradedDb.journalEntries.count()).toBe(0);
    expect(await upgradedDb.gratitudeEntries.count()).toBe(0);
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
